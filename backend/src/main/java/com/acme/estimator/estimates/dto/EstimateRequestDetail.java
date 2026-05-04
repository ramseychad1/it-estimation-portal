package com.acme.estimator.estimates.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Full read view used by the requester's detail page, the reviewer's
 * review screen, and as the response shape for create/update/submit/
 * start/release/approve/reject/sendBack.
 *
 * <p>Phase 9a: the flat per-product fields (productId, subFeatureId,
 * templateId, complexity, status, reviewerId, etc.) are now inside each
 * item in the {@code items} list. The parent-level {@code derivedStatus}
 * is computed from the collection of item statuses — see
 * {@link com.acme.estimator.estimates.EstimateRequestService#getDerivedStatus}.
 */
public record EstimateRequestDetail(
    Long id,
    String title,
    String description,
    Long requesterId,
    /** Derived from items: DRAFT / SUBMITTED / IN_REVIEW / PARTIALLY_APPROVED / APPROVED / NEEDS_REVISION */
    String derivedStatus,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<EstimateRequestItemDto> items
) {}
