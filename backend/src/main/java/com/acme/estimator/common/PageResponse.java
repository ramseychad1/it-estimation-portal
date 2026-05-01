package com.acme.estimator.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * Trim DTO for paginated responses — no Spring Data {@code Page} fields
 * leaking through to the API. Page numbers are zero-based to match Spring.
 *
 * {@code meta} is an optional, list-level extras bag for fields that aren't
 * tied to a specific row (e.g. the Users list returns
 * {@code meta.activeAdminCount} so the last-admin banner doesn't depend on
 * what's visible on the current page). Suppressed from JSON when null so
 * existing endpoints that don't populate it stay byte-identical.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PageResponse<T>(
    List<T> items,
    int page,
    int size,
    long totalElements,
    int totalPages,
    Map<String, Object> meta
) {
    public static <S, T> PageResponse<T> from(Page<S> page, Function<S, T> mapper) {
        return from(page, mapper, null);
    }

    public static <S, T> PageResponse<T> from(
        Page<S> page,
        Function<S, T> mapper,
        Map<String, Object> meta
    ) {
        return new PageResponse<>(
            page.getContent().stream().map(mapper).toList(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            meta
        );
    }
}
