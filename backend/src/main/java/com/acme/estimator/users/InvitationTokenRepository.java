package com.acme.estimator.users;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvitationTokenRepository extends JpaRepository<InvitationToken, Long> {

    Optional<InvitationToken> findByTokenAndUsedAtIsNullAndRevokedAtIsNull(String token);

    /**
     * Find the active (not used, not revoked) token for the given user.
     * Used when revoking before re-issuing on a resend.
     */
    Optional<InvitationToken> findFirstByUserIdAndUsedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(
        Long userId
    );

    Optional<InvitationToken> findByToken(String token);
}
