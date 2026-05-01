package com.acme.estimator.phases.dto;

import com.acme.estimator.phases.SdlcPhase;
import java.time.OffsetDateTime;

public record SdlcPhaseDto(
    Long id,
    String name,
    String description,
    Integer displayOrder,
    boolean active,
    boolean system,
    OffsetDateTime createdAt,
    Long createdBy,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static SdlcPhaseDto from(SdlcPhase p) {
        return new SdlcPhaseDto(
            p.getId(), p.getName(), p.getDescription(),
            p.getDisplayOrder(), p.isActive(), p.isSystem(),
            p.getCreatedAt(), p.getCreatedBy(),
            p.getUpdatedAt(), p.getUpdatedBy()
        );
    }
}
