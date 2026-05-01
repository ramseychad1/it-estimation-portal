package com.acme.estimator.catalog.subfeatures.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSubFeatureRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 4000) String description,
    Boolean active
) {}
