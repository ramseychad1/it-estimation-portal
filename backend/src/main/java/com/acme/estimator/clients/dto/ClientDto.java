package com.acme.estimator.clients.dto;

import com.acme.estimator.clients.Client;
import java.time.OffsetDateTime;

public record ClientDto(
    Long id,
    String name,
    String pointOfContact,
    boolean active,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static ClientDto from(Client c) {
        return new ClientDto(
            c.getId(), c.getName(), c.getPointOfContact(),
            c.isActive(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}
