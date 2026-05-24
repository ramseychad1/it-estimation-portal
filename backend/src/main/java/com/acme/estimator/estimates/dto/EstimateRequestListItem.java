package com.acme.estimator.estimates.dto;

import java.time.LocalDate;
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
    /** Null means the requester selected "Unknown at this time". */
    LocalDate goLiveDate,
    /** Earliest non-null submittedAt across items; null if all items are DRAFT. */
    OffsetDateTime submittedAt,
    OffsetDateTime updatedAt,
    OffsetDateTime createdAt,
    /** Full name of the user who created the request. */
    String requesterName,
    /**
     * Reviewer display for the queue row. One of:
     * <ul>
     *   <li>"Unclaimed" — no item has a reviewer assigned</li>
     *   <li>A single reviewer's full name — all claimed items share the same reviewer</li>
     *   <li>"Multiple" — items are claimed by more than one reviewer</li>
     * </ul>
     */
    String reviewerSummary,
    /** Number of items with status APPROVED. Useful for PARTIALLY_APPROVED progress display. */
    int approvedItemCount,
    /**
     * Total number of active critical questions across all items in this request.
     * 0 when no questions are configured for the chosen product(s).
     */
    int totalQuestionsCount,
    /**
     * Number of questions that have a saved answer across all items.
     * Compare with {@link #totalQuestionsCount} to show a "N / M answered" indicator
     * on the review queue row.
     */
    int answeredQuestionsCount,
    /** "CATALOG" or "INTAKE". Used by the queue to show the INTAKE badge. */
    String requestType
) {}
