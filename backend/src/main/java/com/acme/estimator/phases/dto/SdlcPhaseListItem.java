package com.acme.estimator.phases.dto;

import com.acme.estimator.phases.SdlcPhase;
import java.time.OffsetDateTime;

public record SdlcPhaseListItem(
    Long id,
    String name,
    String description,
    Integer displayOrder,
    boolean active,
    boolean system,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static SdlcPhaseListItem from(SdlcPhase p) {
        return new SdlcPhaseListItem(
            p.getId(), p.getName(), p.getDescription(),
            p.getDisplayOrder(), p.isActive(), p.isSystem(),
            p.getUpdatedAt(), p.getUpdatedBy()
        );
    }
}
