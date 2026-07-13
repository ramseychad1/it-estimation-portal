package com.acme.estimator.clientpricing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Optional per-client pricing override — one row per client. Any non-null field
 * overrides the corresponding category override / global default when resolving
 * effective pricing (precedence: client → category → global). The pricing model
 * is not stored here; it comes from the category.
 */
@Entity
@Table(name = "client_pricing_overrides")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class ClientPricingOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "client_id", nullable = false, unique = true)
    private Long clientId;

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
