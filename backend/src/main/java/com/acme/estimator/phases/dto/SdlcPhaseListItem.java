package com.acme.estimator.phases.dto;

import com.acme.estimator.phases.SdlcPhase;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record SdlcPhaseListItem(
    Long id,
    String name,
    String description,
    Integer displayOrder,
    boolean active,
    boolean system,
    BigDecimal benchmarkLowPct,
    BigDecimal benchmarkMidPct,
    BigDecimal benchmarkHighPct,
    BigDecimal defaultOffshorePct,
    boolean devAnchor,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static SdlcPhaseListItem from(SdlcPhase p) {
        return new SdlcPhaseListItem(
            p.getId(), p.getName(), p.getDescription(),
            p.getDisplayOrder(), p.isActive(), p.isSystem(),
            p.getBenchmarkLowPct(), p.getBenchmarkMidPct(), p.getBenchmarkHighPct(),
            p.getDefaultOffshorePct(), p.isDevAnchor(),
            p.getUpdatedAt(), p.getUpdatedBy()
        );
    }
}
