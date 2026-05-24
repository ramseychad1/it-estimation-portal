package com.acme.estimator.estimates.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * Phase 9a: multi-product draft creation.
 *
 * <p>CATALOG requests (default): items list must contain at least one entry; each item targets
 * a specific catalog product. INTAKE requests: items must be null/empty — the system
 * auto-creates a CONTEXT item tied to the configured intake system product.
 *
 * <p>V21: categoryId (required) and programTypeIds (required, ≥1) added.
 * <p>V22: clientId (required) and programId (required) added.
 * <p>V30: requestType added ("CATALOG" default, "INTAKE" for SO-scoped requests).
 */
public record CreateDraftRequest(
    @NotBlank @Size(max = 255) String title,
    @Size(max = 4000) String description,
    LocalDate goLiveDate,
    @NotNull Long categoryId,
    @NotNull @NotEmpty List<Long> programTypeIds,
    @NotNull Long clientId,
    @NotNull Long programId,
    /** Required for CATALOG requests; must be null/empty for INTAKE requests. */
    @Valid List<CreateItemRequest> items,
    /** "CATALOG" (default) or "INTAKE". */
    String requestType
) {}
