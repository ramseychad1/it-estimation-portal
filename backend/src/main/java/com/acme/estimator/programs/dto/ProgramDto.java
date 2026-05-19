package com.acme.estimator.programs.dto;

import com.acme.estimator.programs.Program;
import java.time.OffsetDateTime;

public record ProgramDto(
    Long id,
    Long clientId,
    String clientName,
    String name,
    boolean active,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static ProgramDto from(Program p, String clientName) {
        return new ProgramDto(
            p.getId(), p.getClientId(), clientName,
            p.getName(), p.isActive(), p.getCreatedAt(), p.getUpdatedAt()
        );
    }
}
