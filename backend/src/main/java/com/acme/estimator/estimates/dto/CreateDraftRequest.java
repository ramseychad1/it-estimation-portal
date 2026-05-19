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
 * <p>The items list must contain at least one entry. Each item targets a
 * specific product (and optional sub-feature for CONTAINER products).
 * The same product may not appear twice in the list (enforced at the service
 * layer, mirroring the database partial-unique-index constraint).
 *
 * <p>V21: categoryId (required) and programTypeIds (required, ≥1) added.
 * <p>V22: clientId (required) and programId (required) added.
 */
public record CreateDraftRequest(
    @NotBlank @Size(max = 255) String title,
    @Size(max = 4000) String description,
    LocalDate goLiveDate,
    @NotNull Long categoryId,
    @NotNull @NotEmpty List<Long> programTypeIds,
    @NotNull Long clientId,
    @NotNull Long programId,
    @NotNull @NotEmpty @Valid List<CreateItemRequest> items
) {}
