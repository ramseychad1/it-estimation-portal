package com.acme.estimator.catalog.products.dto;

import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import java.time.OffsetDateTime;

public record ProductDetail(
    Long id,
    String name,
    String description,
    ProductMode mode,
    boolean active,
    int subFeatureCount,
    int questionCount,
    OffsetDateTime createdAt,
    Long createdBy,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static ProductDetail from(Product p, int subFeatureCount, int questionCount) {
        return new ProductDetail(
            p.getId(),
            p.getName(),
            p.getDescription(),
            p.getMode(),
            p.isActive(),
            subFeatureCount,
            questionCount,
            p.getCreatedAt(),
            p.getCreatedBy(),
            p.getUpdatedAt(),
            p.getUpdatedBy()
        );
    }
}
