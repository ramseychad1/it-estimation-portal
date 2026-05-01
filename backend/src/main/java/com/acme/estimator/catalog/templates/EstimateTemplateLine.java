package com.acme.estimator.catalog.templates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One row in an estimate template — pairs an SDLC phase with its hour
 * estimates across Onshore × Offshore × Low/Med/High. Lines belong to a
 * single template version and are immutable: when a new version is saved,
 * a fresh batch of lines is created alongside the new template row.
 *
 * <p>All six hour columns are NOT NULL (V9). Solution Owners enter explicit
 * zeros where work doesn't apply — the audit trail can't tell "we forgot"
 * apart from "we meant zero" if any column were nullable.
 */
@Entity
@Table(name = "estimate_template_lines")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class EstimateTemplateLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "template_id", nullable = false, updatable = false)
    private Long templateId;

    @Column(name = "sdlc_phase_id", nullable = false, updatable = false)
    private Long sdlcPhaseId;

    @Column(name = "onshore_low", nullable = false, updatable = false)
    private BigDecimal onshoreLow;

    @Column(name = "onshore_med", nullable = false, updatable = false)
    private BigDecimal onshoreMed;

    @Column(name = "onshore_high", nullable = false, updatable = false)
    private BigDecimal onshoreHigh;

    @Column(name = "offshore_low", nullable = false, updatable = false)
    private BigDecimal offshoreLow;

    @Column(name = "offshore_med", nullable = false, updatable = false)
    private BigDecimal offshoreMed;

    @Column(name = "offshore_high", nullable = false, updatable = false)
    private BigDecimal offshoreHigh;
}
