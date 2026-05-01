package com.acme.estimator.rates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A rate row. **IMMUTABLE from the application's perspective** — the service
 * never updates an existing row, the controller has no PATCH/DELETE routes,
 * and the audit story relies on each rate change being a brand-new row.
 *
 * Setters are exposed so JPA can hydrate from the result set, but no code
 * outside {@link BlendedRateService#createRate} should call them.
 */
@Entity
@Table(name = "blended_rates")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class BlendedRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "onshore_rate", nullable = false, updatable = false)
    private BigDecimal onshoreRate;

    @Column(name = "offshore_rate", nullable = false, updatable = false)
    private BigDecimal offshoreRate;

    @Column(name = "effective_date", nullable = false, updatable = false)
    private LocalDate effectiveDate;

    @Column(name = "note", updatable = false)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    public static final String ENTITY_TYPE = "BlendedRate";
}
