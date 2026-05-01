package com.acme.estimator.auth.dto;

import com.acme.estimator.auth.AppUserDetails;
import java.util.List;
import java.util.UUID;

public record CurrentUserResponse(
    UUID id,
    String email,
    String firstName,
    String lastName,
    List<String> roles
) {
    public static CurrentUserResponse from(AppUserDetails details) {
        return new CurrentUserResponse(
            details.getUserId(),
            details.getUsername(),
            details.getFirstName(),
            details.getLastName(),
            details.getRoleNames()
        );
    }
}
