package com.acme.estimator.catalog.templates;

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
 * One version of an estimate template, owned by either a Product (atomic)
 * or a SubFeature. Immutable per version — the service has no UPDATE path;
 * every save creates a new row and flips {@link #isActive} on the previous
 * row to false, all in one transaction. Mirrors the {@link
 * com.acme.estimator.rates.BlendedRate} pattern from Phase 3.
 *
 * <p>The XOR between {@code productId} and {@code subFeatureId} is enforced
 * at the DB level (V8 CHECK constraint) and asserted at the service layer
 * before save.
 */
@Entity
@Table(name = "estimate_templates")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class EstimateTemplate {

    public static final String ENTITY_TYPE = "EstimateTemplate";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    /** Set when the template lives directly under an atomic Product. */
    @Column(name = "product_id", updatable = false)
    private Long productId;

    /** Set when the template lives under a SubFeature. */
    @Column(name = "sub_feature_id", updatable = false)
    private Long subFeatureId;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    /**
     * Exactly one row per parent (Product or SubFeature) has
     * {@code isActive = true} at any given time. Enforced by partial unique
     * indexes (V8). The "save-new-version" service flow flips the previous
     * row to false and inserts the new row inside one transaction.
     */
    @Column(name = "is_active", nullable = false)
    private boolean active;

    /** Optional SO-supplied note explaining what changed in this version. */
    @Column(name = "change_reason", updatable = false)
    private String changeReason;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;
}
