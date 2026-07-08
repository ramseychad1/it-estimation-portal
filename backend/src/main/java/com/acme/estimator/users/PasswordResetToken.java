package com.acme.estimator.users;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Single-use, time-limited token backing the admin-initiated password reset
 * (SEC-1). Deliberately separate from {@link InvitationToken}: an invite
 * activates a PENDING_INVITE account, a reset re-keys an already-ACTIVE one,
 * and keeping them apart means the invite resend/revoke queries can never
 * collide with a reset token. NEVER log the raw {@link #token} value.
 */
@Entity
@Table(name = "password_reset_tokens")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    /** Opaque random token (base64url, 43 chars). */
    @Column(name = "token", nullable = false, updatable = false, length = 64)
    private String token;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    public boolean isUsable(OffsetDateTime now) {
        return usedAt == null && revokedAt == null && now.isBefore(expiresAt);
    }
}
