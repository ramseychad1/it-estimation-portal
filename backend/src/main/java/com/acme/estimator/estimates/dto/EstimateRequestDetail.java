package com.acme.estimator.estimates.dto;

import com.acme.estimator.estimates.Complexity;
import com.acme.estimator.estimates.EstimateStatus;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Full read view used by the requester's detail page, the reviewer's
 * review screen, and as the response shape for create/update/submit/
 * start/release/approve/reject/sendBack.
 *
 * <p><b>{@code reviewerStatus} is per-actor</b> — derived at response
 * time from the calling user's relationship to {@code reviewerId}:
 * "you" if the actor IS the reviewer, "other-so" if some other SO has
 * claimed it, "unclaimed" if {@code reviewerId} is null. Lets the UI
 * decide between editable / claimed-by-X read-only / claim-this-now
 * affordances without re-deriving the state on the client.
 */
public record EstimateRequestDetail(
    Long id,
    String title,
    String description,
    Long productId,
    String productName,
    String teamName,
    Long subFeatureId,
    String subFeatureName,
    Long templateId,
    Integer templateVersionNumber,
    Complexity complexity,
    EstimateStatus status,
    Long requesterId,
    Long reviewerId,
    /** Reviewer's display name (null when {@code reviewerId} is null or actor isn't authorised to see it). */
    String reviewerName,
    /** "you" / "other-so" / "unclaimed". See class javadoc. */
    String reviewerStatus,
    String justification,
    OffsetDateTime submittedAt,
    OffsetDateTime reviewedAt,
    /** Snapshot of the blended-rate id effective at approval; null until APPROVED. */
    Long approvedBlendedRateId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<EstimateRequestPhaseLineView> phaseLines,
    List<EstimateRequestAnswerView> answers
) {}
