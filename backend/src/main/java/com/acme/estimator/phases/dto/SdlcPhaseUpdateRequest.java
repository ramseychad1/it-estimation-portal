package com.acme.estimator.phases.dto;

import jakarta.validation.constraints.Size;

/**
 * Patch shape: all fields optional; null means "no change."
 * Active flips go through /activate and /deactivate (same pattern as Teams),
 * so PATCH bodies that try to flip active are rejected with 400.
 *
 * is_system is intentionally absent — the system flag is set at seed time
 * and cannot be toggled.
 */
public record SdlcPhaseUpdateRequest(
    @Size(max = 255) String name,
    @Size(max = 4000) String description,
    Boolean active
) {}
