package com.acme.estimator.catalog.products.dto;

import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import java.time.OffsetDateTime;

public record ProductListItem(
    Long id,
    String name,
    String description,
    ProductMode mode,
    boolean active,
    int subFeatureCount,
    int questionCount,
    OffsetDateTime updatedAt,
    Long updatedBy,
    OffsetDateTime createdAt,
    Long createdBy
) {
    public static ProductListItem from(Product p, int subFeatureCount, int questionCount) {
        return new ProductListItem(
            p.getId(),
            p.getName(),
            p.getDescription(),
            p.getMode(),
            p.isActive(),
            subFeatureCount,
            questionCount,
            p.getUpdatedAt(),
            p.getUpdatedBy(),
            p.getCreatedAt(),
            p.getCreatedBy()
        );
    }
}
