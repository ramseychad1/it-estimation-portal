package com.acme.estimator.estimates.dto;

import com.acme.estimator.estimates.Complexity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Payload for approving a single estimate-request item.
 *
 * <p>Replaces the two-step Phase 9a flow (saveReviewState + approve):
 * the SO sends complexity, optional justification, and optional line
 * overrides in a single committed action — no interim autosave state.
 */
public record ApproveItemRequest(
    @NotNull Complexity complexity,
    @Size(max = 4000) String justification,
    @Valid List<LineOverrideInput> lineOverrides
) {}
