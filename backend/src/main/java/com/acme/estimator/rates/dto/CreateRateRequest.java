package com.acme.estimator.rates.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Sanity bounds on the rate values so an admin doesn't typo a 6-digit number
 * by accident. The audit-log acknowledgement is a service-side check rather
 * than a validation annotation because Bean Validation's {@code @AssertTrue}
 * looks for an {@code isXxx()} accessor that records don't expose.
 */
public record CreateRateRequest(
    @NotNull @DecimalMin(value = "0.01") @DecimalMax(value = "9999.99")
    BigDecimal onshoreRate,

    @NotNull @DecimalMin(value = "0.01") @DecimalMax(value = "9999.99")
    BigDecimal offshoreRate,

    @NotNull LocalDate effectiveDate,

    @Size(max = 4000) String note,

    boolean confirmationAcknowledged
) {}
