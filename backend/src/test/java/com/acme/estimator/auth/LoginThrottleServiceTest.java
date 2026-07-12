package com.acme.estimator.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class LoginThrottleServiceTest {

    private final Instant t0 = Instant.parse("2026-07-09T12:00:00Z");

    private LoginThrottleService serviceAt(Instant now) {
        LoginThrottleService s = new LoginThrottleService();
        s.setClock(Clock.fixed(now, ZoneOffset.UTC));
        return s;
    }

    @Test
    void locksAfterMaxFailures() {
        LoginThrottleService s = serviceAt(t0);

        // First (MAX-1) failures don't lock.
        for (int i = 0; i < LoginThrottleService.MAX_FAILURES - 1; i++) {
            s.recordFailure("victim@local");
            assertThatCode(() -> s.assertNotLocked("victim@local")).doesNotThrowAnyException();
        }
        // The threshold failure locks it.
        s.recordFailure("victim@local");
        assertThatThrownBy(() -> s.assertNotLocked("victim@local"))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("Too many failed sign-in attempts");
    }

    @Test
    void successResetsTheCounter() {
        LoginThrottleService s = serviceAt(t0);
        for (int i = 0; i < LoginThrottleService.MAX_FAILURES - 1; i++) {
            s.recordFailure("victim@local");
        }
        s.recordSuccess("victim@local");

        // Counter cleared — a fresh run of failures is needed to lock again.
        for (int i = 0; i < LoginThrottleService.MAX_FAILURES - 1; i++) {
            s.recordFailure("victim@local");
        }
        assertThatCode(() -> s.assertNotLocked("victim@local")).doesNotThrowAnyException();
    }

    @Test
    void lockExpiresAfterCooldown() {
        LoginThrottleService s = serviceAt(t0);
        for (int i = 0; i < LoginThrottleService.MAX_FAILURES; i++) {
            s.recordFailure("victim@local");
        }
        assertThatThrownBy(() -> s.assertNotLocked("victim@local"))
            .isInstanceOf(ResponseStatusException.class);

        // Advance past the lock window — the account is usable again.
        s.setClock(Clock.fixed(t0.plus(LoginThrottleService.LOCK_DURATION).plus(Duration.ofSeconds(1)), ZoneOffset.UTC));
        assertThatCode(() -> s.assertNotLocked("victim@local")).doesNotThrowAnyException();
    }

    @Test
    void keyingIsCaseAndWhitespaceInsensitive() {
        LoginThrottleService s = serviceAt(t0);
        for (int i = 0; i < LoginThrottleService.MAX_FAILURES; i++) {
            s.recordFailure("  Victim@Local  ");
        }
        // Same account, different casing/spacing — still locked.
        assertThatThrownBy(() -> s.assertNotLocked("victim@local"))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void unknownEmailIsNeverLockedUntilItFails() {
        LoginThrottleService s = serviceAt(t0);
        assertThatCode(() -> s.assertNotLocked("never-seen@local")).doesNotThrowAnyException();
    }
}
