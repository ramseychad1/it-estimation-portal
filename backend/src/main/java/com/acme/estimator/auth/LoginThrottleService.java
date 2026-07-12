package com.acme.estimator.auth;

import static org.springframework.http.HttpStatus.TOO_MANY_REQUESTS;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Login throttling (SEC-4). {@code login()} had no brute-force defence, so
 * unlimited password guesses against a known email were bounded only by network
 * throughput. This tracks consecutive failures and locks out once a threshold
 * is crossed — <b>per account</b> (email) and, as of WEB-09, <b>per client
 * IP</b> to blunt password spraying across many accounts from one source.
 *
 * <p>Deliberately app-level (not just nginx): the backend has its own public
 * Railway domain, so a rate limit at the frontend proxy would be bypassable by
 * hitting the backend directly. In-memory is sufficient for the current
 * single-instance deployment — a restart clears counters (mild fail-open, but
 * an attacker can't force restarts, and the lock window is short). If the
 * backend ever runs multiple instances, promote this to a shared store.
 *
 * <p>Keying by email means an attacker can lock out a known account (a DoS
 * trade-off inherent to account lockout); the short window and internal-tool
 * audience make that acceptable. The message never reveals whether the email
 * exists — any email with too many failures locks, real or not.
 *
 * <p><b>Per-IP caveat:</b> the client IP comes from the leftmost
 * {@code X-Forwarded-For} entry (set by Railway's edge for real clients), so
 * legitimate users are keyed by their own IP — no cross-user lockout via the
 * shared proxy address. The header is client-spoofable, so the per-IP cap is a
 * speed-bump against naive spraying, not a hard control; the per-account lock
 * remains the primary defence. The IP threshold is high so shared-NAT users
 * aren't caught.
 */
@Service
public class LoginThrottleService {

    static final int MAX_FAILURES = 8;
    static final int MAX_IP_FAILURES = 50;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    /** Above this many tracked keys, drop entries with no active lock. */
    private static final int MAP_SOFT_CAP = 10_000;

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();
    private final Map<String, Attempt> ipAttempts = new ConcurrentHashMap<>();
    private Clock clock = Clock.systemUTC();

    /** Test seam. */
    void setClock(Clock c) {
        this.clock = c;
    }

    // ---- account-only (existing callers / tests) ------------------------

    /** Reject the attempt before authenticating if the account is locked. */
    public void assertNotLocked(String email) {
        assertNotLockedOn(attempts, key(email));
    }

    /** Count a failed attempt; lock the account once the threshold is reached. */
    public void recordFailure(String email) {
        Instant now = clock.instant();
        recordFailureOn(attempts, key(email), MAX_FAILURES, now);
        purgeIfLarge(attempts, now);
    }

    // ---- account + per-IP (WEB-09) --------------------------------------

    /** Reject if either the account or the client IP is currently locked. */
    public void assertNotLocked(String email, String clientIp) {
        assertNotLockedOn(attempts, key(email));
        if (clientIp != null && !clientIp.isBlank()) {
            assertNotLockedOn(ipAttempts, clientIp);
        }
    }

    /** Count a failed attempt against both the account and the client IP. */
    public void recordFailure(String email, String clientIp) {
        Instant now = clock.instant();
        recordFailureOn(attempts, key(email), MAX_FAILURES, now);
        if (clientIp != null && !clientIp.isBlank()) {
            recordFailureOn(ipAttempts, clientIp, MAX_IP_FAILURES, now);
        }
        purgeIfLarge(attempts, now);
        purgeIfLarge(ipAttempts, now);
    }

    /**
     * Clear the account's failure state on a successful sign-in. The per-IP
     * counter is intentionally NOT cleared, so a spray that lands one hit can't
     * reset its own IP lock; it expires with the window.
     */
    public void recordSuccess(String email) {
        attempts.remove(key(email));
    }

    // ---- internals ------------------------------------------------------

    private void assertNotLockedOn(Map<String, Attempt> map, String k) {
        Attempt a = map.get(k);
        if (a != null && a.lockedUntil != null && clock.instant().isBefore(a.lockedUntil)) {
            throw new ResponseStatusException(
                TOO_MANY_REQUESTS,
                "Too many failed sign-in attempts. Please wait a few minutes and try again.");
        }
    }

    private void recordFailureOn(Map<String, Attempt> map, String k, int maxFailures, Instant now) {
        map.compute(k, (kk, a) -> {
            // Fresh window when new, or when a prior lock has already expired.
            if (a == null || (a.lockedUntil != null && !now.isBefore(a.lockedUntil))) {
                a = new Attempt();
            }
            a.failures++;
            if (a.failures >= maxFailures) {
                a.lockedUntil = now.plus(LOCK_DURATION);
                a.failures = 0; // the lock, not the counter, governs from here
            }
            return a;
        });
    }

    private void purgeIfLarge(Map<String, Attempt> map, Instant now) {
        if (map.size() <= MAP_SOFT_CAP) return;
        map.entrySet().removeIf(e -> {
            Attempt a = e.getValue();
            return a.lockedUntil == null || now.isAfter(a.lockedUntil);
        });
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static final class Attempt {
        int failures;
        Instant lockedUntil;
    }
}
