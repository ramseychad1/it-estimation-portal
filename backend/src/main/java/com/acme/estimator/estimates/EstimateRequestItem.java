package com.acme.estimator.estimates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One product-scoped item within an estimate request.
 *
 * <p>Phase 9a moves all per-product state out of {@link EstimateRequest}
 * into this child table. An estimate request now contains one or more items,
 * each targeting a specific product (and optional sub-feature for CONTAINER
 * products).
 *
 * <p><b>Snapshot semantics</b>: same as the former single-product model —
 * on submission the active template's hour rows are copied into
 * {@link EstimateRequestPhaseLine} rows keyed to this item, and question
 * text is frozen in {@link EstimateRequestQuestionAnswer} rows.
 *
 * <p><b>Status per item</b>: each item has its own {@link EstimateStatus}.
 * The parent request's "derived status" is computed in the service from the
 * collection of item statuses.
 */
@Entity
@Table(name = "estimate_request_items")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class EstimateRequestItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    /** FK to the parent estimate request. Locked once created. */
    @Column(name = "estimate_request_id", nullable = false, updatable = false)
    private Long estimateRequestId;

    /** Mutable during REJECTED revision (requester may swap products). */
    @Column(name = "product_id", nullable = false)
    private Long productId;

    /** Set only when the chosen product is CONTAINER. Mutable during REJECTED revision. */
    @Column(name = "sub_feature_id")
    private Long subFeatureId;

    /** Snapshot reference: null while DRAFT, populated on submission. */
    @Column(name = "template_id")
    private Long templateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private EstimateStatus status = EstimateStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "complexity", length = 8)
    private Complexity complexity;

    /** Set when an SO claims this item for review. */
    @Column(name = "reviewer_id")
    private Long reviewerId;

    /** Reviewer's free-form justification text. */
    @Column(name = "justification")
    private String justification;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    /**
     * Snapshot of the blended-rate row effective at approval time.
     * NULL until the IN_REVIEW → APPROVED transition; cleared on send-back.
     */
    @Column(name = "approved_blended_rate_id")
    private Long approvedBlendedRateId;

    /**
     * SO's explanation when rejecting. Cleared when the requester revises
     * and resubmits the item.
     */
    @Column(name = "rejection_reason")
    private String rejectionReason;

    /**
     * Pricing model snapshotted at approval time (e.g. "TARGET_MARGIN").
     * NULL until approved; cleared on admin send-back.
     */
    @Column(name = "approved_pricing_model", length = 20)
    private String approvedPricingModel;

    @Column(name = "approved_tm_multiplier", precision = 12, scale = 4)
    private BigDecimal approvedTmMultiplier;

    @Column(name = "approved_tm_target_margin_pct", precision = 5, scale = 2)
    private BigDecimal approvedTmTargetMarginPct;

    @Column(name = "approved_mat_billable_rate", precision = 12, scale = 2)
    private BigDecimal approvedMatBillableRate;

    @Column(name = "approved_mat_discount_pct", precision = 5, scale = 2)
    private BigDecimal approvedMatDiscountPct;

    /**
     * SO's question to the requester when requesting clarification.
     * Set on NEEDS_CLARIFICATION, cleared when the requester resubmits.
     */
    @Column(name = "clarification_note")
    private String clarificationNote;

    /**
     * Requester's free-form reply when responding to a clarification request.
     * Saved on resubmit so the reviewer can read it when the item re-enters IN_REVIEW.
     * Cleared when the SO raises a new clarification request.
     */
    @Column(name = "clarification_response")
    private String clarificationResponse;

    /**
     * Incremented each time the requester submits a revision for this item.
     * Displayed in the Revision History tab.
     */
    @Column(name = "revision_count", nullable = false)
    private int revisionCount = 0;

    /**
     * Set to the item's original {@code productId} on the FIRST product swap
     * during revision. Null until the requester picks a different product;
     * unchanged on subsequent swaps so the original trail is preserved.
     */
    @Column(name = "original_product_id")
    private Long originalProductId;

    /** Ordering within the parent request. */
    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;
}
