package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * Patch-style: a field is only applied when the JSON key is present (non-null).
 * Title cannot be blanked but may be omitted.
 *
 * <p>goLiveDate is always applied when present — null means "unknown / clear",
 * not "omitted". The frontend always includes it.
 *
 * <p>categoryId: null = don't change (category is required, cannot be cleared).
 * programTypeIds: null = don't change; non-null list must be non-empty (≥1).
 */
public record UpdateDraftRequest(
    @Size(min = 1, max = 255) String title,
    @Size(max = 4000) String description,
    LocalDate goLiveDate,
    Long categoryId,
    List<Long> programTypeIds
) {}
