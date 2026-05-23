package com.acme.estimator.estimates.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Full read view used by the requester's detail page, the reviewer's
 * review screen, and as the response shape for create/update/submit/
 * start/release/approve/reject/sendBack.
 *
 * <p>Phase 9a: the flat per-product fields are now inside each item in
 * the {@code items} list. The parent-level {@code derivedStatus} is
 * computed from the collection of item statuses.
 *
 * <p>V21: categoryId/categoryName and programTypeIds/programTypeNames added.
 * <p>V22: clientId/clientName and programId/programName added.
 */
public record EstimateRequestDetail(
    Long id,
    String title,
    String description,
    /** Null means the requester selected "Unknown at this time". */
    LocalDate goLiveDate,
    Long requesterId,
    /** Derived from items: DRAFT / SUBMITTED / IN_REVIEW / PARTIALLY_APPROVED / APPROVED / NEEDS_REVISION */
    String derivedStatus,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<EstimateRequestItemDto> items,
    Long categoryId,
    String categoryName,
    List<Long> programTypeIds,
    List<String> programTypeNames,
    Long clientId,
    String clientName,
    Long programId,
    String programName,
    // ── Pricing review (V27 / V28) ────────────────────────────────────────
    /** PENDING | IN_REVIEW | APPROVED | null (not applicable). */
    String pricingReviewStatus,
    Long rmReviewerId,
    BigDecimal rmDiscountPct,
    String rmNotes,
    OffsetDateTime rmReviewedAt,
    /** Free-form context the requester supplied when sending this estimate for (re-)pricing review. */
    String requesterPricingContext
) {}
