package com.acme.estimator.audit.read.dto;

/** Slim actor projection embedded in each {@link ChangeLogGroupDto}. */
public record ChangeLogActorDto(Long id, String name) {}
