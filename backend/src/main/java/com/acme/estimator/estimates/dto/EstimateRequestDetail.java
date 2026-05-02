package com.acme.estimator.estimates.dto;

import com.acme.estimator.estimates.Complexity;
import com.acme.estimator.estimates.EstimateStatus;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Full read view used by the requester's detail page and as the response
 * shape for create/update/submit. Phase 6a populates everything except
 * {@link #complexity}, {@link #justification}, and {@link #reviewerId}
 * (those land in Phase 6b's Reviewer flow).
 */
public record EstimateRequestDetail(
    Long id,
    String title,
    String description,
    Long productId,
    String productName,
    Long subFeatureId,
    String subFeatureName,
    Long templateId,
    Integer templateVersionNumber,
    Complexity complexity,
    EstimateStatus status,
    Long requesterId,
    Long reviewerId,
    String justification,
    OffsetDateTime submittedAt,
    OffsetDateTime reviewedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<EstimateRequestPhaseLineView> phaseLines,
    List<EstimateRequestAnswerView> answers
) {}
