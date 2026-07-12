package com.acme.estimator.phases.dto;

import com.acme.estimator.phases.SdlcPhase;
import java.math.BigDecimal;

/**
 * One phase's benchmark configuration, as returned by the benchmark editor.
 * Percentages are fractions (0.35 = 35%).
 */
public record PhaseBenchmarkRow(
    Long id,
    String name,
    Integer displayOrder,
    boolean active,
    BigDecimal benchmarkLowPct,
    BigDecimal benchmarkTargetPct,
    BigDecimal benchmarkHighPct,
    BigDecimal defaultOffshorePct,
    boolean devAnchor
) {
    public static PhaseBenchmarkRow from(SdlcPhase p) {
        return new PhaseBenchmarkRow(
            p.getId(), p.getName(), p.getDisplayOrder(), p.isActive(),
            p.getBenchmarkLowPct(), p.getBenchmarkTargetPct(), p.getBenchmarkHighPct(),
            p.getDefaultOffshorePct(), p.isDevAnchor()
        );
    }
}
