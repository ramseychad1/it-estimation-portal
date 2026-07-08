package com.acme.estimator.users;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(String token);

    /** Outstanding (unused, unrevoked) reset tokens for a user — revoked when a new one is minted. */
    List<PasswordResetToken> findByUserIdAndUsedAtIsNullAndRevokedAtIsNull(Long userId);
}
