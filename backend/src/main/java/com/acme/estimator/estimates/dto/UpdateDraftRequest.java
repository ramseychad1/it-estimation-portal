package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Patch-style: a field is only applied if the JSON key is present
 * (non-null). Title cannot be blanked but may be omitted.
 *
 * <p>goLiveDate is always applied when present in the payload — null means
 * "unknown / clear the date", not "field omitted". The frontend always
 * includes it so the intent is unambiguous.
 */
public record UpdateDraftRequest(
    @Size(min = 1, max = 255) String title,
    @Size(max = 4000) String description,
    LocalDate goLiveDate
) {}
