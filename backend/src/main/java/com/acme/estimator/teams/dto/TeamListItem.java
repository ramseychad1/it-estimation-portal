package com.acme.estimator.teams.dto;

import com.acme.estimator.teams.Team;
import java.time.OffsetDateTime;

public record TeamListItem(
    Long id,
    String name,
    String description,
    boolean active,
    long productCount,
    long memberCount,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static TeamListItem from(Team team, long productCount, long memberCount) {
        return new TeamListItem(
            team.getId(),
            team.getName(),
            team.getDescription(),
            team.isActive(),
            productCount,
            memberCount,
            team.getUpdatedAt(),
            team.getUpdatedBy()
        );
    }
}
