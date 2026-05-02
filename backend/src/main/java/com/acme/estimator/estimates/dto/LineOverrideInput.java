package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * One per-cell override. Either or both override values may be null —
 * a null override "reverts" that cell to the snapshot value.
 */
public record LineOverrideInput(
    @NotNull Long sdlcPhaseId,
    @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal onshoreOverride,
    @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal offshoreOverride
) {}
