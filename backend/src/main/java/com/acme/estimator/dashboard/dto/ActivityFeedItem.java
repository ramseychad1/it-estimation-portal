package com.acme.estimator.dashboard.dto;

import com.acme.estimator.audit.read.dto.ChangeLogActorDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.OffsetDateTime;

/**
 * One row in the dashboard activity feed.
 *
 * <p>Mirrors a subset of {@link com.acme.estimator.audit.read.dto.ChangeLogGroupDto}:
 * the dashboard reuses Phase 4's {@code DescriptionFormatter} +
 * {@code EntityHrefResolver} but DOESN'T need the per-field {@code changes}
 * list (the dashboard is a glance surface — full details live on
 * {@code /admin/change-log} or the entity's own detail page).
 *
 * <p>Per-row group folding (the 2s window collapse used on the Change Log
 * page) is intentionally NOT applied here either — the dashboard shows
 * the raw stream so the recency signal is strong. Reusing the grouped
 * view would mean burying recent UPDATEDs under a single envelope; the
 * Change Log page is the right surface for that view.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ActivityFeedItem(
    Long id,
    OffsetDateTime timestamp,
    ChangeLogActorDto actor,
    String description,
    String entityType,
    String entityHref,
    String actionLabel
) {}
