package com.acme.estimator.phases;

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

@Entity
@Table(name = "sdlc_phases")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class SdlcPhase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "is_system", nullable = false, updatable = false)
    private boolean system = false;

    // ---- Benchmark distribution (V38) --------------------------------------
    // Fractions (0.35 = 35%). low/mid/high are nullable — a phase can exist
    // without a benchmark. Exactly one phase carries devAnchor = true; its
    // mid % divides development hours to back-solve total project hours.
    @Column(name = "benchmark_low_pct")
    private BigDecimal benchmarkLowPct;

    @Column(name = "benchmark_mid_pct")
    private BigDecimal benchmarkMidPct;

    @Column(name = "benchmark_high_pct")
    private BigDecimal benchmarkHighPct;

    @Column(name = "default_offshore_pct", nullable = false)
    private BigDecimal defaultOffshorePct = BigDecimal.ZERO;

    @Column(name = "is_dev_anchor", nullable = false)
    private boolean devAnchor = false;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by", nullable = false)
    private Long updatedBy;

    public static final String ENTITY_TYPE = "SdlcPhase";
}
