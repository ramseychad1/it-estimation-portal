package com.acme.estimator.catalog.subfeatures.dto;

import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.templatefiles.TemplateFileMeta;
import java.time.OffsetDateTime;

public record SubFeatureDetail(
    Long id,
    Long productId,
    String name,
    String description,
    boolean active,
    int questionCount,
    TemplateFileMeta templateFile,
    OffsetDateTime createdAt,
    Long createdBy,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static SubFeatureDetail from(SubFeature s, int questionCount, TemplateFileMeta templateFile) {
        return new SubFeatureDetail(
            s.getId(),
            s.getProductId(),
            s.getName(),
            s.getDescription(),
            s.isActive(),
            questionCount,
            templateFile,
            s.getCreatedAt(),
            s.getCreatedBy(),
            s.getUpdatedAt(),
            s.getUpdatedBy()
        );
    }
}
