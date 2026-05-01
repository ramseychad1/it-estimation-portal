package com.acme.estimator.audit.read.dto;

import com.acme.estimator.audit.ChangeAction;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * One audit "event" as the UI sees it.
 *
 * A single PATCH that touches three fields on a Team writes three
 * {@code change_log} rows but renders as ONE group with three
 * {@code changes}. Two patches > 2 seconds apart render as two groups.
 *
 * {@code description} is pre-rendered server-side (one less rendering rule
 * for the frontend); structured fields are also exposed so the frontend
 * can make actor and entity name clickable.
 *
 * {@code viewEntityHref} is null when the entity has been deleted.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChangeLogGroupDto(
    String id,
    String entityType,
    Long entityId,
    String entityName,
    boolean entityDeleted,
    ChangeAction action,
    ChangeLogActorDto actor,
    OffsetDateTime changedAt,
    String source,
    String description,
    List<ChangeLogChangeDto> changes,
    String viewEntityHref
) {}
