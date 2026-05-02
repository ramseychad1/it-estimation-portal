package com.acme.estimator.estimates;

/**
 * Reviewer-chosen complexity for an estimate request. One value per
 * request (not per phase) — the choice flows to every phase row's
 * Onshore/Offshore column. Phase 6a stores the slot; Phase 6b's Reviewer
 * surface populates it.
 */
public enum Complexity {
    LOW,
    MED,
    HIGH
}
