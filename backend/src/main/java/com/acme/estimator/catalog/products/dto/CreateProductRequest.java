package com.acme.estimator.catalog.products.dto;

import com.acme.estimator.catalog.products.ProductMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateProductRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 4000) String description,
    @NotNull ProductMode mode,
    Boolean active,
    /** Required. Must reference an active team. */
    @NotNull Long teamId
) {}
