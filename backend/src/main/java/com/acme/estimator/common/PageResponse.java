package com.acme.estimator.common;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * Trim DTO for paginated responses — no Spring Data {@code Page} fields
 * leaking through to the API. Page numbers are zero-based to match Spring.
 */
public record PageResponse<T>(
    List<T> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {
    public static <S, T> PageResponse<T> from(Page<S> page, java.util.function.Function<S, T> mapper) {
        return new PageResponse<>(
            page.getContent().stream().map(mapper).toList(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages()
        );
    }
}
