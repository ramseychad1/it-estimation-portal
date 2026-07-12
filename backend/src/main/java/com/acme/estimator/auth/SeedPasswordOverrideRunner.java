package com.acme.estimator.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
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
 * <p><b>Production enforcement (WEB-01):</b> a blank override no longer just
 * warns in a deployed environment — it fails startup. "Production" is detected
 * automatically (an active {@code prod}/{@code production} profile, or Railway's
 * injected {@code RAILWAY_ENVIRONMENT_NAME}); local dev and tests keep the loud
 * WARN so the seed default stays usable there. Override the auto-detection
 * explicitly with {@code app.security.require-seed-password-override=true|false}.
 * This guarantees a deploy that forgets the env var can never silently run with
 * the published {@code ChangeMe123!} default.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SeedPasswordOverrideRunner implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Value("${ADMIN_INITIAL_PASSWORD:}")
    private String adminInitialPassword;

    @Value("${ESTIMATOR_INITIAL_PASSWORD:}")
    private String estimatorInitialPassword;

    /** Explicit toggle: true/false forces enforcement; unset ({@code null}) = auto-detect. */
    @Value("${app.security.require-seed-password-override:#{null}}")
    private Boolean requireSeedPasswordOverride;

    @Override
    @Transactional
    public void run(String... args) {
        applyIfSet("admin@local", adminInitialPassword, "ADMIN_INITIAL_PASSWORD");
        applyIfSet("estimator@local", estimatorInitialPassword, "ESTIMATOR_INITIAL_PASSWORD");
    }

    private void applyIfSet(String email, String plaintext, String envVarName) {
        if (plaintext == null || plaintext.isBlank()) {
            if (enforcementRequired()) {
                // Fail fast: refuse to boot a production environment with the
                // published dev-default password still active.
                throw new IllegalStateException(
                    envVarName + " is not set. Refusing to start a production environment with the "
                        + "published dev-default password for " + email + ". Set " + envVarName
                        + ", or set app.security.require-seed-password-override=false to opt out.");
            }
            log.warn(
                "{} not set — {} keeps the dev-default password from the V2/V5 seed. "
                    + "Fine for local dev; a deployed environment MUST set this env var.",
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

    /**
     * Whether a blank override must fail startup. The explicit property wins;
     * otherwise auto-detect a production environment — an active {@code prod}/
     * {@code production} Spring profile, or Railway's injected
     * {@code RAILWAY_ENVIRONMENT_NAME}. Local dev and the test suite match none
     * of these, so they keep the WARN-and-continue behavior.
     */
    private boolean enforcementRequired() {
        if (requireSeedPasswordOverride != null) {
            return requireSeedPasswordOverride;
        }
        for (String profile : environment.getActiveProfiles()) {
            if (profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production")) {
                return true;
            }
        }
        String railwayEnv = environment.getProperty("RAILWAY_ENVIRONMENT_NAME");
        return railwayEnv != null && !railwayEnv.isBlank();
    }
}
