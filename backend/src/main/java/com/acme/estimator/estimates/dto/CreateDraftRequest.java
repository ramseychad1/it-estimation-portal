package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateDraftRequest(
    @NotBlank @Size(max = 255) String title,
    @NotNull Long productId,
    Long subFeatureId,
    @Size(max = 4000) String description
) {}
