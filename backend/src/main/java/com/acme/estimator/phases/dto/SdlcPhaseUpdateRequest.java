package com.acme.estimator.phases.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Patch shape: all fields optional; null means "no change."
 * Active flips go through /activate and /deactivate (same pattern as Teams),
 * so PATCH bodies that try to flip active are rejected with 400.
 *
 * is_system is intentionally absent — the system flag is set at seed time
 * and cannot be toggled.
 *
 * Benchmark fields (fractions, 0.35 = 35%) are edited here too. {@code
 * devAnchor} = true moves the single dev-hours anchor to this phase (clearing
 * it elsewhere); false on the current anchor is rejected — set another phase
 * instead. Null on any benchmark field means "leave unchanged."
 */
public record SdlcPhaseUpdateRequest(
    @Size(max = 255) String name,
    @Size(max = 4000) String description,
    Boolean active,
    @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal benchmarkLowPct,
    @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal benchmarkMidPct,
    @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal benchmarkHighPct,
    @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal defaultOffshorePct,
    Boolean devAnchor
) {}
