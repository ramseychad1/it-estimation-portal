package com.acme.estimator.catalog.templates.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The full template state returned by GET / POST / PUT. Lines arrive
 * pre-sorted by SDLC phase display_order; the grid renders them in
 * insertion order without needing a re-sort.
 *
 * <p>{@code null} return body for GET means "no template yet" (Day 1) —
 * the controller writes JSON {@code null} so the React Query hook can
 * branch cleanly.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TemplateView(
    Long id,
    Long productId,
    Long subFeatureId,
    int versionNumber,
    boolean active,
    String changeReason,
    OffsetDateTime createdAt,
    Long createdBy,
    /** Server-rendered "Estimate template for X — v3" used by the audit feed. */
    String displayName,
    List<TemplateLineView> lines
) {}
