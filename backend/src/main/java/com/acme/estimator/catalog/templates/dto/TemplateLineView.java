package com.acme.estimator.catalog.templates.dto;

import java.math.BigDecimal;

/**
 * One row in the template grid as the UI sees it. Carries the phase
 * metadata the grid needs (name, displayOrder, active) so the client
 * doesn't need a second round-trip per row.
 */
public record TemplateLineView(
    Long sdlcPhaseId,
    String sdlcPhaseName,
    int sdlcPhaseDisplayOrder,
    boolean sdlcPhaseActive,
    BigDecimal onshoreLow,
    BigDecimal onshoreMed,
    BigDecimal onshoreHigh,
    BigDecimal offshoreLow,
    BigDecimal offshoreMed,
    BigDecimal offshoreHigh
) {}
