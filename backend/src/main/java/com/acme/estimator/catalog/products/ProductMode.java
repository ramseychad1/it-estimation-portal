package com.acme.estimator.catalog.products;

/**
 * A Product is one of two shapes, fixed at creation:
 *
 * <ul>
 *   <li>{@code ATOMIC}    — single estimate template, no sub-features.</li>
 *   <li>{@code CONTAINER} — has sub-features; each sub-feature carries its
 *                           own estimate template.</li>
 * </ul>
 *
 * Mode is immutable after persist (DB CHECK + JPA {@code updatable=false} +
 * service-layer rejection — three layers of defence). Once committed, a
 * Product cannot become the other mode; the right move is to deactivate
 * and create a fresh row.
 */
public enum ProductMode {
    ATOMIC,
    CONTAINER
}
