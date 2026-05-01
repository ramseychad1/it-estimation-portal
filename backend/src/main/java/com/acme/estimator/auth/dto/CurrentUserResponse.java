package com.acme.estimator.auth.dto;

import com.acme.estimator.auth.AppUserDetails;
import java.util.List;

public record CurrentUserResponse(
    Long id,
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
