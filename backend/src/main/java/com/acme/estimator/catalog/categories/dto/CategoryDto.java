package com.acme.estimator.catalog.categories.dto;

import com.acme.estimator.catalog.categories.Category;
import java.time.OffsetDateTime;

public record CategoryDto(
    Long id,
    String name,
    Integer displayOrder,
    boolean active,
    String pricingModel,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static CategoryDto from(Category c) {
        return new CategoryDto(
            c.getId(), c.getName(), c.getDisplayOrder(),
            c.isActive(), c.getPricingModel(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}
