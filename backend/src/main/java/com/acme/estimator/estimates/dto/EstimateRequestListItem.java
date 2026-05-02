package com.acme.estimator.estimates.dto;

import com.acme.estimator.estimates.EstimateRequest;
import com.acme.estimator.estimates.EstimateStatus;
import java.time.OffsetDateTime;

public record EstimateRequestListItem(
    Long id,
    String title,
    Long productId,
    String productName,
    Long subFeatureId,
    String subFeatureName,
    EstimateStatus status,
    OffsetDateTime submittedAt,
    OffsetDateTime updatedAt,
    OffsetDateTime createdAt
) {
    public static EstimateRequestListItem from(
        EstimateRequest req, String productName, String subFeatureName
    ) {
        return new EstimateRequestListItem(
            req.getId(),
            req.getTitle(),
            req.getProductId(),
            productName,
            req.getSubFeatureId(),
            subFeatureName,
            req.getStatus(),
            req.getSubmittedAt(),
            req.getUpdatedAt(),
            req.getCreatedAt()
        );
    }
}
