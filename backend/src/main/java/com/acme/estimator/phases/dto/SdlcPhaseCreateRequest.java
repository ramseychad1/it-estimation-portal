package com.acme.estimator.phases.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SdlcPhaseCreateRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 4000) String description,
    Boolean active
) {}
