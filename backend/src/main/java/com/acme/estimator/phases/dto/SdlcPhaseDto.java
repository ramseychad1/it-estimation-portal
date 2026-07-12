package com.acme.estimator.phases.dto;

import com.acme.estimator.phases.SdlcPhase;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record SdlcPhaseDto(
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
    OffsetDateTime createdAt,
    Long createdBy,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static SdlcPhaseDto from(SdlcPhase p) {
        return new SdlcPhaseDto(
            p.getId(), p.getName(), p.getDescription(),
            p.getDisplayOrder(), p.isActive(), p.isSystem(),
            p.getBenchmarkLowPct(), p.getBenchmarkMidPct(), p.getBenchmarkHighPct(),
            p.getDefaultOffshorePct(), p.isDevAnchor(),
            p.getCreatedAt(), p.getCreatedBy(),
            p.getUpdatedAt(), p.getUpdatedBy()
        );
    }
}
