package com.acme.estimator.teams.dto;

import com.acme.estimator.teams.Team;
import java.time.OffsetDateTime;

public record TeamListItem(
    Long id,
    String name,
    String description,
    boolean active,
    int productCount,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static TeamListItem from(Team team) {
        return new TeamListItem(
            team.getId(),
            team.getName(),
            team.getDescription(),
            team.isActive(),
            0,
            team.getUpdatedAt(),
            team.getUpdatedBy()
        );
    }
}
