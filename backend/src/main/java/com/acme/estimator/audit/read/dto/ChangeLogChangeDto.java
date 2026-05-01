package com.acme.estimator.audit.read.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Single field-level change inside a {@link ChangeLogGroupDto}.
 *
 * Both old/new can be null (e.g. clearing a description). The frontend
 * renders null/empty as a styled placeholder, not the literal string "null".
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ChangeLogChangeDto(
    String field,
    String oldValue,
    String newValue
) {}
