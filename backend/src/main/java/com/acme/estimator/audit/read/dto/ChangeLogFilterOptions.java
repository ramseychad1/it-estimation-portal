package com.acme.estimator.audit.read.dto;

import java.util.List;

public record ChangeLogFilterOptions(
    List<EntityFilterOption> entityTypes,
    List<ActionFilterOption> actions,
    List<UserFilterOption> actors
) {}
