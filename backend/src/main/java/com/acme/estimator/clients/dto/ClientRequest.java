package com.acme.estimator.clients.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClientRequest(
    @NotBlank @Size(max = 255) String name,
    @NotBlank @Size(max = 255) String pointOfContact,
    boolean active
) {}
