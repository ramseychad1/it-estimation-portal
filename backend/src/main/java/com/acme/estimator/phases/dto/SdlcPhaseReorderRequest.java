package com.acme.estimator.phases.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * Full intended order. The server validates that the list contains exactly
 * the current set of phase ids (no missing, no extras, no duplicates), then
 * rewrites display_order = 1..N in this sequence.
 */
public record SdlcPhaseReorderRequest(
    @NotEmpty List<Long> phaseIds
) {}
