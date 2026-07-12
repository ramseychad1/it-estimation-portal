package com.acme.estimator.phases.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * The full benchmark editor payload: the global default contingency % plus
 * every phase's benchmark row (ordered by display order). The client derives
 * the target-% sum and any warnings; the server does not gate on them.
 */
public record PhaseBenchmarksResponse(
    BigDecimal defaultContingencyPct,
    List<PhaseBenchmarkRow> phases
) {}
