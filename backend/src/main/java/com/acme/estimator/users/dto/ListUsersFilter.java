package com.acme.estimator.users.dto;

import com.acme.estimator.auth.InvitationStatus;
import java.util.List;

/**
 * Filter envelope assembled from request params for {@code GET /api/admin/users}.
 * Lives in DTO-land so the controller stays readable.
 */
public record ListUsersFilter(
    String search,
    List<String> roleNames,
    InvitationStatus status
) {}
