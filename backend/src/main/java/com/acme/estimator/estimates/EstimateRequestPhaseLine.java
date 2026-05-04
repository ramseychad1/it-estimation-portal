package com.acme.estimator.estimates;

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
 * One per-phase row in a submitted estimate request — copied at
 * submission time from {@code estimate_template_lines}. The six base hour
 * columns are immutable (the snapshot); {@link #onshoreOverride} and
 * {@link #offshoreOverride} are the Reviewer's per-row overrides
 * (populated in Phase 6b).
 *
 * <p>{@link #sdlcPhaseNameSnapshot} and {@link #sdlcPhaseDisplayOrderSnapshot}
 * exist so the read view renders correctly even after a phase is renamed
 * or reordered post-submission.
 */
@Entity
@Table(name = "estimate_request_phase_lines")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class EstimateRequestPhaseLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "estimate_request_item_id", nullable = false, updatable = false)
    private Long itemId;

    @Column(name = "sdlc_phase_id", nullable = false, updatable = false)
    private Long sdlcPhaseId;

    @Column(name = "sdlc_phase_name_snapshot", nullable = false, updatable = false)
    private String sdlcPhaseNameSnapshot;

    @Column(name = "sdlc_phase_display_order_snapshot", nullable = false, updatable = false)
    private int sdlcPhaseDisplayOrderSnapshot;

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

    @Column(name = "onshore_override")
    private BigDecimal onshoreOverride;

    @Column(name = "offshore_override")
    private BigDecimal offshoreOverride;
}
