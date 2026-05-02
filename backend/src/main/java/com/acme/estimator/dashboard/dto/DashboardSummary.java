package com.acme.estimator.dashboard.dto;

import java.util.List;

/**
 * Top-level dashboard summary payload — the role-filtered list of stat
 * cards. Order is set by the service so the frontend doesn't have to
 * re-sort. See {@link com.acme.estimator.dashboard.DashboardService} for
 * the canonical ordering.
 */
public record DashboardSummary(List<StatCard> cards) {}
