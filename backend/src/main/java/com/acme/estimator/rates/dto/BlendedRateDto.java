package com.acme.estimator.rates.dto;

import com.acme.estimator.rates.BlendedRate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record BlendedRateDto(
    Long id,
    BigDecimal onshoreRate,
    BigDecimal offshoreRate,
    LocalDate effectiveDate,
    String note,
    OffsetDateTime createdAt,
    Long createdBy,
    boolean current,
    boolean scheduled
) {
    public static BlendedRateDto from(BlendedRate r, boolean current, boolean scheduled) {
        return new BlendedRateDto(
            r.getId(),
            r.getOnshoreRate(),
            r.getOffshoreRate(),
            r.getEffectiveDate(),
            r.getNote(),
            r.getCreatedAt(),
            r.getCreatedBy(),
            current,
            scheduled
        );
    }
}
