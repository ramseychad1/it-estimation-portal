package com.acme.estimator.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 7.5+ deployment hardening — overrides the seeded passwords for
 * {@code admin@local} and {@code estimator@local} at startup using
 * env-var values, so the dev-default {@code ChangeMe123!} hashes from
 * V2 / V5 don't survive into a deployed environment.
 *
 * <p>Behavior:
 * <ul>
 *   <li>{@code ADMIN_INITIAL_PASSWORD} unset → log a WARN, leave the V2
 *       seed hash alone. Acceptable for local dev (where the .yml has
 *       no env vars) but loud enough that a deploy without the env var
 *       set is obvious in the startup log.</li>
 *   <li>{@code ADMIN_INITIAL_PASSWORD} set → BCrypt-hash it and UPDATE
 *       the {@code admin@local} row. Idempotent: re-running with the
 *       same value re-hashes (BCrypt always produces a new salt) but
 *       the result is still a valid hash for the same plaintext.</li>
 *   <li>Same logic applies independently for
 *       {@code ESTIMATOR_INITIAL_PASSWORD} → {@code estimator@local}.</li>
 * </ul>
 *
 * <p>Why a runner instead of a Flyway migration? Flyway runs once per
 * version; if you rotate the password later you'd have to add a new
 * migration. This runner re-applies on every startup so rotating is
 * just changing the env var and redeploying. The user rows themselves
 * stay seeded by V2 / V5 (so the {@code id=1} / {@code id=2} pinned
 * ids that audit rows reference don't shift).
 *
 * <p>Why not require the env var to be set in non-dev? Spring profiles
 * could enforce that, but the failure mode is "app crashes on startup
 * with credentials missing" — annoying for local docker runs. A loud
 * WARN is the pragmatic middle ground.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SeedPasswordOverrideRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_INITIAL_PASSWORD:}")
    private String adminInitialPassword;

    @Value("${ESTIMATOR_INITIAL_PASSWORD:}")
    private String estimatorInitialPassword;

    @Override
    @Transactional
    public void run(String... args) {
        applyIfSet("admin@local", adminInitialPassword, "ADMIN_INITIAL_PASSWORD");
        applyIfSet("estimator@local", estimatorInitialPassword, "ESTIMATOR_INITIAL_PASSWORD");
    }

    private void applyIfSet(String email, String plaintext, String envVarName) {
        if (plaintext == null || plaintext.isBlank()) {
            log.warn(
                "{} not set — {} keeps the dev-default password from the V2/V5 seed. "
                    + "DO NOT deploy to a non-local environment without setting this env var.",
                envVarName, email
            );
            return;
        }
        userRepository.findByEmailIgnoreCase(email).ifPresentOrElse(
            user -> {
                user.setPasswordHash(passwordEncoder.encode(plaintext));
                userRepository.save(user);
                log.info("{} password updated from {} env var.", email, envVarName);
            },
            () -> log.info("{} not present — skipping {} override.", email, envVarName)
        );
    }
}
