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
 * Per-account login throttling (SEC-4). {@code login()} had no brute-force
 * defence, so unlimited password guesses against a known email were bounded
 * only by network throughput. This tracks consecutive failures per email and
 * locks the account out for a cooldown once a threshold is crossed.
 *
 * <p>Deliberately app-level (not just nginx): the backend has its own public
 * Railway domain, so a rate limit at the frontend proxy would be bypassable
 * by hitting the backend directly. In-memory is sufficient for the current
 * single-instance deployment — a restart clears counters (mild fail-open,
 * but an attacker can't force restarts, and the lock window is short). If the
 * backend ever runs multiple instances, promote this to a shared store.
 *
 * <p>Keying by email means an attacker can lock out a known account (a DoS
 * trade-off inherent to account lockout); the short window and internal-tool
 * audience make that acceptable. The message never reveals whether the email
 * exists — any email with too many failures locks, real or not.
 */
@Service
public class LoginThrottleService {

    static final int MAX_FAILURES = 8;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    /** Above this many tracked emails, drop entries with no active lock. */
    private static final int MAP_SOFT_CAP = 10_000;

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();
    private Clock clock = Clock.systemUTC();

    /** Test seam. */
    void setClock(Clock c) {
        this.clock = c;
    }

    /** Reject the attempt before authenticating if the account is locked. */
    public void assertNotLocked(String email) {
        Attempt a = attempts.get(key(email));
        if (a != null && a.lockedUntil != null && clock.instant().isBefore(a.lockedUntil)) {
            throw new ResponseStatusException(
                TOO_MANY_REQUESTS,
                "Too many failed sign-in attempts. Please wait a few minutes and try again.");
        }
    }

    /** Count a bad-credentials attempt; lock once the threshold is reached. */
    public void recordFailure(String email) {
        Instant now = clock.instant();
        attempts.compute(key(email), (k, a) -> {
            // Fresh window when new, or when a prior lock has already expired.
            if (a == null || (a.lockedUntil != null && !now.isBefore(a.lockedUntil))) {
                a = new Attempt();
            }
            a.failures++;
            if (a.failures >= MAX_FAILURES) {
                a.lockedUntil = now.plus(LOCK_DURATION);
                a.failures = 0; // the lock, not the counter, governs from here
            }
            return a;
        });
        purgeIfLarge(now);
    }

    /** Clear all failure state for the account on a successful sign-in. */
    public void recordSuccess(String email) {
        attempts.remove(key(email));
    }

    private void purgeIfLarge(Instant now) {
        if (attempts.size() <= MAP_SOFT_CAP) return;
        attempts.entrySet().removeIf(e -> {
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
