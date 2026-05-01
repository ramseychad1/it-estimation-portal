package com.acme.estimator.users.dto;

import com.acme.estimator.auth.InvitationStatus;
import com.acme.estimator.auth.User;
import java.time.OffsetDateTime;
import java.util.List;

public record UserListItem(
    Long id,
    String email,
    String firstName,
    String lastName,
    InvitationStatus invitationStatus,
    boolean active,
    List<String> roles,
    OffsetDateTime lastActiveAt,
    OffsetDateTime createdAt
) {
    public static UserListItem from(User u) {
        return new UserListItem(
            u.getId(),
            u.getEmail(),
            u.getFirstName(),
            u.getLastName(),
            u.getInvitationStatus(),
            u.isActive(),
            u.getRoles().stream().map(r -> r.getName()).sorted().toList(),
            u.getLastActiveAt(),
            u.getCreatedAt()
        );
    }
}
