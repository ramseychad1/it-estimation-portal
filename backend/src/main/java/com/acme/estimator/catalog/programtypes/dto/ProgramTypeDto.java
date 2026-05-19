package com.acme.estimator.catalog.programtypes.dto;

import com.acme.estimator.catalog.programtypes.ProgramType;
import java.time.OffsetDateTime;

public record ProgramTypeDto(
    Long id,
    String name,
    Integer displayOrder,
    boolean active,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static ProgramTypeDto from(ProgramType p) {
        return new ProgramTypeDto(
            p.getId(), p.getName(), p.getDisplayOrder(),
            p.isActive(), p.getCreatedAt(), p.getUpdatedAt()
        );
    }
}
