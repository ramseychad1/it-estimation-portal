package com.acme.estimator.phases.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

/**
 * Bulk save of the benchmark editor. One transaction updates the global
 * contingency default and every phase's benchmark fields. Exactly one row
 * must carry {@code devAnchor = true} (enforced in the service).
 */
public record PhaseBenchmarksUpdateRequest(
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal defaultContingencyPct,
    @NotNull @Valid List<Row> phases
) {
    public record Row(
        @NotNull Long id,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal benchmarkLowPct,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal benchmarkTargetPct,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal benchmarkHighPct,
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal defaultOffshorePct,
        boolean devAnchor
    ) {}
}
