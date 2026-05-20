package com.acme.estimator.clientpricing.dto;

import com.acme.estimator.clientpricing.ClientPricingDefaults;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ClientPricingDefaultsDto(
    Long id,
    BigDecimal tmMultiplier,
    BigDecimal tmTargetMarginPct,
    BigDecimal matBillableRate,
    BigDecimal matDiscountPct,
    OffsetDateTime updatedAt
) {
    public static ClientPricingDefaultsDto from(ClientPricingDefaults d) {
        return new ClientPricingDefaultsDto(
            d.getId(),
            d.getTmMultiplier(),
            d.getTmTargetMarginPct(),
            d.getMatBillableRate(),
            d.getMatDiscountPct(),
            d.getUpdatedAt()
        );
    }
}
