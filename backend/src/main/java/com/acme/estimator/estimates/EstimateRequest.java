package com.acme.estimator.estimates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A Requester's estimate request — the parent container for one or more
 * {@link EstimateRequestItem} rows, each targeting a specific product.
 *
 * <p>Phase 9a: all per-product state (productId, subFeatureId, templateId,
 * complexity, status, reviewerId, justification, submittedAt, reviewedAt,
 * approvedBlendedRateId) moved out into {@link EstimateRequestItem}. The
 * parent request now carries only identity (id, title, description,
 * requesterId) and timestamps.
 *
 * <p>The "derived status" of the request (DRAFT / SUBMITTED / IN_REVIEW /
 * PARTIALLY_APPROVED / APPROVED / NEEDS_REVISION) is computed in the service
 * from the collection of item statuses — it is NOT stored in the database.
 */
@Entity
@Table(name = "estimate_requests")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class EstimateRequest {

    public static final String ENTITY_TYPE = "EstimateRequest";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    /** Locked once the Draft is created. */
    @Column(name = "requester_id", nullable = false, updatable = false)
    private Long requesterId;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;
}
