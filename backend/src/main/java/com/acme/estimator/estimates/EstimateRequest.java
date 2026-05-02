package com.acme.estimator.estimates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * A Requester's estimate request against a Product (and optional
 * Sub-feature for CONTAINER products).
 *
 * <p><b>Snapshot semantics on submission.</b> When status flips from
 * {@code DRAFT} → {@code SUBMITTED} the active estimate template's hour
 * rows are COPIED into {@link EstimateRequestPhaseLine} rows; the
 * questions' current text is COPIED into {@link
 * EstimateRequestQuestionAnswer#getQuestionTextSnapshot()}. The
 * {@link #templateId} on this row is the snapshot reference — it points
 * at the template version that existed at submission, not whatever is
 * "active now."
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

    /** Locked once the Draft is created — see EstimateRequestService. */
    @Column(name = "product_id", nullable = false, updatable = false)
    private Long productId;

    /** Set only when the chosen product is CONTAINER. Locked once set. */
    @Column(name = "sub_feature_id", updatable = false)
    private Long subFeatureId;

    /** Snapshot reference: null while DRAFT, populated on submission. */
    @Column(name = "template_id")
    private Long templateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "complexity", length = 8)
    private Complexity complexity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private EstimateStatus status = EstimateStatus.DRAFT;

    /** Audit-FK relaxation pattern (no FK to users). */
    @Column(name = "requester_id", nullable = false, updatable = false)
    private Long requesterId;

    /** Set when an SO claims the request for review (Phase 6b). */
    @Column(name = "reviewer_id")
    private Long reviewerId;

    /** Reviewer's free-form text (Phase 6b populates). */
    @Column(name = "justification")
    private String justification;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;
}
