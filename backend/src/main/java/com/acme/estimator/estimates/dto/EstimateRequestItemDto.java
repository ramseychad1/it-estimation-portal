package com.acme.estimator.estimates.dto;

import com.acme.estimator.estimates.Complexity;
import com.acme.estimator.estimates.EstimateStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Full read view for one item within an estimate request.
 *
 * <p>{@code reviewerStatus} is per-actor — "you" if the caller IS the
 * reviewer, "other-so" if some other SO has claimed it, "unclaimed" if
 * {@code reviewerId} is null.
 *
 * <p>{@code isReviewable} is context-dependent: true when the authenticated
 * user is an SO on the item's product team and the item is in an actionable
 * state (SUBMITTED or IN_REVIEW by this SO). Always false for admin/requester
 * views where the annotation is not meaningful.
 */
public record EstimateRequestItemDto(
    Long id,
    Long productId,
    String productName,
    Long subFeatureId,
    String subFeatureName,
    String teamName,
    Long templateId,
    Integer templateVersionNumber,
    EstimateStatus status,
    Complexity complexity,
    Long reviewerId,
    String reviewerName,
    /** "you" / "other-so" / "unclaimed". */
    String reviewerStatus,
    String justification,
    OffsetDateTime submittedAt,
    OffsetDateTime reviewedAt,
    Long approvedBlendedRateId,
    int displayOrder,
    List<EstimateRequestPhaseLineView> phaseLines,
    List<EstimateRequestAnswerView> answers,
    // ---- Phase 9b fields ------------------------------------------------
    /** SO's rejection explanation; null unless status is REJECTED. */
    String rejectionReason,
    /** Number of times the requester has revised and resubmitted this item. */
    int revisionCount,
    /** The product id before a swap; null if the product has never been swapped. */
    Long originalProductId,
    /** Display name for originalProductId; null if no swap has occurred. */
    String originalProductName,
    /**
     * True when the authenticated user is an SO on this item's team and the
     * item is in an actionable state. Populated only on reviewer-facing reads.
     */
    boolean isReviewable,
    // ---- Phase 10 fields ------------------------------------------------
    /** SO's clarification question; non-null only when status is NEEDS_CLARIFICATION. */
    String clarificationNote,
    /** Requester's reply to the clarification; non-null once the requester has responded. */
    String clarificationResponse,
    // ---- Pricing fields (V25) -------------------------------------------
    /**
     * Effective pricing model for this item's category. For APPROVED items
     * this is the snapshotted value; for live items it reflects the current
     * effective config (category override merged with global defaults).
     * Null when the category has no pricing model assigned.
     */
    String pricingModel,
    BigDecimal tmMultiplier,
    BigDecimal tmTargetMarginPct,
    BigDecimal matBillableRate,
    BigDecimal matDiscountPct
) {}
