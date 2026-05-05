package com.acme.estimator.auth.dto;

import com.acme.estimator.auth.AppUserDetails;
import java.util.List;
import java.util.Set;

public record CurrentUserResponse(
    Long id,
    String email,
    String firstName,
    String lastName,
    List<String> roles,
    Set<Long> teamIds
) {
    public static CurrentUserResponse from(AppUserDetails details, Set<Long> teamIds) {
        return new CurrentUserResponse(
            details.getUserId(),
            details.getUsername(),
            details.getFirstName(),
            details.getLastName(),
            details.getRoleNames(),
            teamIds
        );
    }
}
