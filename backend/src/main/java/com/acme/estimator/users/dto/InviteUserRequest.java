package com.acme.estimator.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record InviteUserRequest(
    @NotBlank @Email @Size(max = 255) String email,
    @NotBlank @Size(max = 100) String firstName,
    @NotBlank @Size(max = 100) String lastName,
    @NotEmpty List<Short> roleIds,
    @Min(1) @Max(90) Integer expiresInDays,
    @Size(max = 1000) String personalNote
) {}
