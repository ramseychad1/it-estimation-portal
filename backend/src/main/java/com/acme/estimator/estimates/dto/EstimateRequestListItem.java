package com.acme.estimator.estimates.dto;

import java.time.OffsetDateTime;

/**
 * Compact list-view DTO for estimate requests.
 *
 * <p>Phase 9a: the flat productId/subFeatureId/status fields have been
 * replaced by derived multi-product fields. {@code derivedStatus} is
 * computed from item statuses; {@code productNames} is a comma-joined
 * display string of the first few products.
 */
public record EstimateRequestListItem(
    Long id,
    String title,
    /** Derived from items: DRAFT / SUBMITTED / IN_REVIEW / PARTIALLY_APPROVED / APPROVED / NEEDS_REVISION */
    String derivedStatus,
    int itemCount,
    /** Comma-joined display string of product names (+ sub-feature if applicable), truncated at 3. */
    String productNames,
    /** Earliest non-null submittedAt across items; null if all items are DRAFT. */
    OffsetDateTime submittedAt,
    OffsetDateTime updatedAt,
    OffsetDateTime createdAt
) {}
