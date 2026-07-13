package com.acme.estimator.clientpricing.dto;

import com.acme.estimator.clientpricing.ClientPricingOverride;
import java.math.BigDecimal;

/**
 * What the client-setup pricing panel needs: this client's override values
 * (null where inheriting) PLUS the global defaults, so the UI can show the
 * inherited values as reference next to the override inputs.
 */
public record ClientPricingConfigDto(
    Long clientId,
    BigDecimal overrideTmMultiplier,
    BigDecimal overrideTmTargetMarginPct,
    BigDecimal overrideMatBillableRate,
    BigDecimal overrideMatDiscountPct,
    ClientPricingDefaultsDto defaults
) {
    public static ClientPricingConfigDto of(
        Long clientId,
        ClientPricingOverride override,
        ClientPricingDefaultsDto defaults
    ) {
        return new ClientPricingConfigDto(
            clientId,
            override != null ? override.getTmMultiplier() : null,
            override != null ? override.getTmTargetMarginPct() : null,
            override != null ? override.getMatBillableRate() : null,
            override != null ? override.getMatDiscountPct() : null,
            defaults
        );
    }
}
