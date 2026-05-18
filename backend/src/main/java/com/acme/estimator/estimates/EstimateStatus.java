package com.acme.estimator.estimates;

/**
 * State machine for {@link EstimateRequest}. Phase 6a only fires the
 * {@code DRAFT → SUBMITTED} transition; the rest are reachable in Phase 6b
 * once the Reviewer surface ships. The data model and service signatures
 * support all five today so 6b is purely UI work on top.
 */
public enum EstimateStatus {
    DRAFT,
    SUBMITTED,
    IN_REVIEW,
    APPROVED,
    REJECTED,
    /** SO requested clarification from the requester. Item stays assigned to the SO. */
    NEEDS_CLARIFICATION,
    /** Requester pulled the item back from SUBMITTED or IN_REVIEW. Returns to editable state. */
    RECALLED
}
