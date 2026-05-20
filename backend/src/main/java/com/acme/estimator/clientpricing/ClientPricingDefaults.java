package com.acme.estimator.clientpricing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "client_pricing_defaults")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class ClientPricingDefaults {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "tm_multiplier")
    private BigDecimal tmMultiplier;

    @Column(name = "tm_target_margin_pct")
    private BigDecimal tmTargetMarginPct;

    @Column(name = "mat_billable_rate")
    private BigDecimal matBillableRate;

    @Column(name = "mat_discount_pct")
    private BigDecimal matDiscountPct;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;
}
