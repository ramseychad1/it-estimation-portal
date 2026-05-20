package com.acme.estimator.clientpricing.dto;

import java.math.BigDecimal;

public record UpdateDefaultsRequest(
    BigDecimal tmMultiplier,
    BigDecimal tmTargetMarginPct,
    BigDecimal matBillableRate,
    BigDecimal matDiscountPct
) {}
