package com.acme.estimator.catalog.programtypes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProgramTypeRequest(
    @NotBlank @Size(max = 255) String name,
    boolean active
) {}
