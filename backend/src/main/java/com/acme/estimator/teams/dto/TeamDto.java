package com.acme.estimator.teams.dto;

import com.acme.estimator.teams.Team;
import java.time.OffsetDateTime;

public record TeamDto(
    Long id,
    String name,
    String description,
    boolean active,
    OffsetDateTime createdAt,
    Long createdBy,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static TeamDto from(Team team) {
        return new TeamDto(
            team.getId(),
            team.getName(),
            team.getDescription(),
            team.isActive(),
            team.getCreatedAt(),
            team.getCreatedBy(),
            team.getUpdatedAt(),
            team.getUpdatedBy()
        );
    }
}
