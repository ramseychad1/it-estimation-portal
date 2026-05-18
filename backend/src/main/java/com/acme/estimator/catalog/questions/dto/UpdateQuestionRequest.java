package com.acme.estimator.catalog.questions.dto;

import jakarta.validation.constraints.Size;

/**
 * PATCH payload. Parent FKs ({@code productId} / {@code subFeatureId}) and
 * the active flag are intentionally absent — the service rejects any
 * attempt to change parent (questions can't migrate between Product /
 * SubFeature) and active flips go through {@code POST /activate} or
 * {@code POST /deactivate}.
 */
public record UpdateQuestionRequest(
    @Size(max = 4000) String questionText,
    @Size(max = 4000) String helpText,
    Boolean required,
    Boolean documentUploadEnabled,
    Boolean documentUploadRequired
) {}
