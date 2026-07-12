package com.acme.estimator.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/**
 * Server-side pagination bounds (SEC-4). List endpoints take a caller-supplied
 * {@code size}; without a ceiling a single request can ask for an arbitrarily
 * large page and force a heavy DB read + serialization (CWE-400). Every list
 * endpoint routes its page/size through here so the cap can't be forgotten at
 * one call site.
 */
public final class PageLimits {

    public static final int MAX_SIZE = 100;

    private PageLimits() {}

    /** Clamp requested page size to [1, {@link #MAX_SIZE}]. */
    public static int size(int requested) {
        if (requested < 1) return 1;
        return Math.min(requested, MAX_SIZE);
    }

    /** Clamp requested page index to >= 0. */
    public static int page(int requested) {
        return Math.max(requested, 0);
    }

    public static PageRequest of(int page, int size) {
        return PageRequest.of(page(page), size(size));
    }

    public static PageRequest of(int page, int size, Sort sort) {
        return PageRequest.of(page(page), size(size), sort);
    }
}
