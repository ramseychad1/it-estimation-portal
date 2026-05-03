package com.acme.estimator.users.dto;

import com.acme.estimator.auth.InvitationStatus;
import com.acme.estimator.auth.User;
import com.acme.estimator.teams.dto.TeamRef;
import java.time.OffsetDateTime;
import java.util.List;

public record UserDetail(
    Long id,
    String email,
    String firstName,
    String lastName,
    InvitationStatus invitationStatus,
    boolean active,
    List<String> roles,
    List<TeamRef> teams,
    OffsetDateTime invitedAt,
    Long invitedBy,
    OffsetDateTime invitationExpiresAt,
    OffsetDateTime invitationAcceptedAt,
    OffsetDateTime lastActiveAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static UserDetail from(User u, List<TeamRef> teams) {
        return new UserDetail(
            u.getId(),
            u.getEmail(),
            u.getFirstName(),
            u.getLastName(),
            u.getInvitationStatus(),
            u.isActive(),
            u.getRoles().stream().map(r -> r.getName()).sorted().toList(),
            teams != null ? teams : List.of(),
            u.getInvitedAt(),
            u.getInvitedBy(),
            u.getInvitationExpiresAt(),
            u.getInvitationAcceptedAt(),
            u.getLastActiveAt(),
            u.getCreatedAt(),
            u.getUpdatedAt()
        );
    }
}
