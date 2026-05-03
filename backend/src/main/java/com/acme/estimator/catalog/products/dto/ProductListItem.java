package com.acme.estimator.catalog.products.dto;

import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.teams.dto.TeamRef;
import java.time.OffsetDateTime;

public record ProductListItem(
    Long id,
    String name,
    String description,
    ProductMode mode,
    boolean active,
    TeamRef team,
    int subFeatureCount,
    int questionCount,
    OffsetDateTime updatedAt,
    Long updatedBy,
    OffsetDateTime createdAt,
    Long createdBy
) {
    public static ProductListItem from(Product p, int subFeatureCount, int questionCount) {
        TeamRef teamRef = p.getTeam() != null ? TeamRef.from(p.getTeam()) : null;
        return new ProductListItem(
            p.getId(),
            p.getName(),
            p.getDescription(),
            p.getMode(),
            p.isActive(),
            teamRef,
            subFeatureCount,
            questionCount,
            p.getUpdatedAt(),
            p.getUpdatedBy(),
            p.getCreatedAt(),
            p.getCreatedBy()
        );
    }
}
