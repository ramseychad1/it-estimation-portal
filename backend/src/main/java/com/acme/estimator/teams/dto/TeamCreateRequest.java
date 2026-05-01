package com.acme.estimator.teams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TeamCreateRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 4000) String description,
    Boolean active
) {}
