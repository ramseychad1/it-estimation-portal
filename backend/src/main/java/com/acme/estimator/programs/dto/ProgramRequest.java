package com.acme.estimator.programs.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProgramRequest(
    @NotNull Long clientId,
    @NotBlank @Size(max = 255) String name,
    boolean active
) {}
