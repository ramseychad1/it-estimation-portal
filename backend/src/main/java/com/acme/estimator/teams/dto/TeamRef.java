package com.acme.estimator.teams.dto;

import com.acme.estimator.teams.Team;

/** Lightweight team reference used in UserListItem, UserDetail, ProductListItem, ProductDetail. */
public record TeamRef(Long id, String name) {
    public static TeamRef from(Team t) {
        return new TeamRef(t.getId(), t.getName());
    }
}
