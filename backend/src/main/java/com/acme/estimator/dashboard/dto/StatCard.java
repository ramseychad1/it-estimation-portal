package com.acme.estimator.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One stat-card row in the dashboard summary.
 *
 * <p>{@code key} is the stable identifier the frontend keys ordering off
 * (e.g. "myDrafts", "awaitingReview"). {@code label} is the rendered
 * heading; {@code description} is the optional one-line context line.
 *
 * <p>Cards are filtered server-side based on the actor's roles — the
 * frontend renders whatever it gets, no per-card visibility logic on the
 * client. See {@link com.acme.estimator.dashboard.DashboardService}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StatCard(
    String key,
    String label,
    long count,
    String description
) {}
