package com.acme.estimator.teams.dto;

import jakarta.validation.constraints.Size;

/**
 * Patch shape: every field optional. A null field means "no change."
 * Use the wrapper Boolean for active so we can distinguish "set to false"
 * from "don't touch."
 *
 * The active toggle on this DTO is intentionally rejected at the service
 * layer — flips of the active flag go through the dedicated
 * /activate and /deactivate endpoints so the change_log records ACTIVATED /
 * DEACTIVATED actions instead of an UPDATED row on the active field.
 */
public record TeamUpdateRequest(
    @Size(max = 255) String name,
    @Size(max = 4000) String description,
    Boolean active
) {}
