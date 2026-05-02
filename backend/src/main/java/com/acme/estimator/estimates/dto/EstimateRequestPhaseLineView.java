package com.acme.estimator.estimates.dto;

import java.math.BigDecimal;

public record EstimateRequestPhaseLineView(
    Long sdlcPhaseId,
    String sdlcPhaseName,
    int displayOrder,
    BigDecimal onshoreLow,
    BigDecimal onshoreMed,
    BigDecimal onshoreHigh,
    BigDecimal offshoreLow,
    BigDecimal offshoreMed,
    BigDecimal offshoreHigh,
    BigDecimal onshoreOverride,
    BigDecimal offshoreOverride
) {}
