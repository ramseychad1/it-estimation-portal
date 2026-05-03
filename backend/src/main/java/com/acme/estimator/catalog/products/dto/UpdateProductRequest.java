package com.acme.estimator.catalog.products.dto;

import com.acme.estimator.catalog.products.ProductMode;
import jakarta.validation.constraints.Size;

/**
 * PATCH payload for a product. All fields are optional — only the fields
 * the caller wants to change. Any non-null {@link #mode} or {@link #active}
 * here is rejected by the service:
 *
 * <ul>
 *   <li>{@code mode} cannot be changed after creation (DB CHECK + JPA
 *       updatable=false + service rejection — three layers).</li>
 *   <li>{@code active} flips go through {@code POST /activate} and
 *       {@code POST /deactivate}, never PATCH — keeps audit-row shape
 *       (ACTIVATED / DEACTIVATED) consistent and avoids quiet flips.</li>
 * </ul>
 *
 * Both fields are present on the DTO so the controller can surface a
 * clean 400 with the reason rather than silently ignoring them.
 */
public record UpdateProductRequest(
    @Size(max = 255) String name,
    @Size(max = 4000) String description,
    ProductMode mode,
    Boolean active,
    /** Optional. If provided, must reference an active team. Product can move teams. */
    Long teamId
) {}
