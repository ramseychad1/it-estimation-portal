package com.acme.estimator.catalog.subfeatures.dto;

import com.acme.estimator.catalog.subfeatures.SubFeature;
import java.time.OffsetDateTime;

public record SubFeatureDetail(
    Long id,
    Long productId,
    String name,
    String description,
    boolean active,
    int questionCount,
    OffsetDateTime createdAt,
    Long createdBy,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static SubFeatureDetail from(SubFeature s, int questionCount) {
        return new SubFeatureDetail(
            s.getId(),
            s.getProductId(),
            s.getName(),
            s.getDescription(),
            s.isActive(),
            questionCount,
            s.getCreatedAt(),
            s.getCreatedBy(),
            s.getUpdatedAt(),
            s.getUpdatedBy()
        );
    }
}
