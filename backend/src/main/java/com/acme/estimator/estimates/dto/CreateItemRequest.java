package com.acme.estimator.estimates.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * One product-scoped item within a {@link CreateDraftRequest}.
 *
 * <p>Answers are optional at draft-creation time — the requester can save
 * answers later via PUT /{id}/items/{itemId}/answers. Providing answers
 * here is a convenience shortcut for single-step create flows.
 */
public record CreateItemRequest(
    @NotNull Long productId,
    Long subFeatureId,
    @Valid List<AnswerInput> answers
) {}
