package com.acme.estimator.catalog.products.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for DELETE /api/catalog/products/{id} — typed-name confirmation. */
public record DeleteProductRequest(@NotBlank String confirmationName) {}
