package com.acme.estimator.estimates.dto;

import jakarta.validation.Valid;
import java.util.List;

/**
 * Requester payload for the combined revise + resubmit endpoint.
 *
 * <p>All fields are optional:
 * <ul>
 *   <li>{@code productId} — present when the requester wants to swap to a different product.
 *   <li>{@code subFeatureId} — required when the new product is a CONTAINER; null otherwise.
 *   <li>{@code answers} — when present, replaces all existing answers (replace-all pattern).
 * </ul>
 *
 * <p>If {@code productId} matches the item's current product, no swap is performed
 * (treated as answer-only revision).
 */
public record ReviseAndResubmitRequest(
    Long productId,
    Long subFeatureId,
    @Valid List<AnswerInput> answers,
    /** Requester's free-form reply to the SO's clarification note. Optional. */
    String clarificationResponse
) {}
