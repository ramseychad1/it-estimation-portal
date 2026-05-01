package com.acme.estimator.catalog.subfeatures.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for DELETE /api/catalog/sub-features/{id} — typed-name confirmation. */
public record DeleteSubFeatureRequest(@NotBlank String confirmationName) {}
