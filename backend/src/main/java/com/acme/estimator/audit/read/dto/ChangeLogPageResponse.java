package com.acme.estimator.audit.read.dto;

import java.util.List;

/**
 * Page of audit groups.
 *
 * {@code totalElements} reflects raw {@code change_log} rows matching the
 * filters; the page-count fields ({@code totalPages}, {@code hasMore})
 * reflect the grouped view. This is intentional: showing an exact group
 * count would require materialising the entire grouped result set, and the
 * audit log isn't a place where exact statistics matter — the user is
 * scrolling through history.
 */
public record ChangeLogPageResponse(
    List<ChangeLogGroupDto> groups,
    int page,
    int size,
    long totalElements,
    boolean hasMore
) {}
