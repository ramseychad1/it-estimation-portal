package com.acme.estimator.catalog.subfeatures.dto;

import com.acme.estimator.catalog.subfeatures.SubFeature;
import java.time.OffsetDateTime;

public record SubFeatureListItem(
    Long id,
    Long productId,
    String name,
    String description,
    boolean active,
    int questionCount,
    OffsetDateTime updatedAt,
    Long updatedBy,
    OffsetDateTime createdAt,
    Long createdBy
) {
    public static SubFeatureListItem from(SubFeature s, int questionCount) {
        return new SubFeatureListItem(
            s.getId(),
            s.getProductId(),
            s.getName(),
            s.getDescription(),
            s.isActive(),
            questionCount,
            s.getUpdatedAt(),
            s.getUpdatedBy(),
            s.getCreatedAt(),
            s.getCreatedBy()
        );
    }
}
