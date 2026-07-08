package com.acme.estimator.estimates;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EstimateRequestItemRepository
    extends JpaRepository<EstimateRequestItem, Long> {

    /** Load all items for a request, sorted by display order. */
    List<EstimateRequestItem> findByEstimateRequestIdOrderByDisplayOrderAsc(Long requestId);

    /** Scoped lookup: item must belong to the given request (for ownership checks). */
    Optional<EstimateRequestItem> findByIdAndEstimateRequestId(Long itemId, Long requestId);

    /** Used during discard — CASCADE handles phase lines + answers. */
    void deleteAllByEstimateRequestId(Long requestId);

    // ---- Dashboard item-level counts (Phase 9b M4) -------------------------

    /**
     * Count SUBMITTED items whose product belongs to the SO's accessible teams.
     * Used for the SO "Awaiting review" dashboard stat card.
     */
    @Query("SELECT COUNT(i) FROM EstimateRequestItem i WHERE i.status = 'SUBMITTED' AND i.productId IN :productIds")
    long countSubmittedForProducts(@Param("productIds") Set<Long> productIds);

    /**
     * Count all SUBMITTED items across the system (admin view of awaiting review).
     */
    @Query("SELECT COUNT(i) FROM EstimateRequestItem i WHERE i.status = 'SUBMITTED'")
    long countAllSubmitted();

    /**
     * Count IN_REVIEW items claimed by a specific reviewer.
     * Used for the SO "My active reviews" dashboard stat card.
     */
    @Query("SELECT COUNT(i) FROM EstimateRequestItem i WHERE i.status = 'IN_REVIEW' AND i.reviewerId = :reviewerId")
    long countInReviewByReviewer(@Param("reviewerId") Long reviewerId);

    // ---- Team workload reporting (UX-3: rebuilt after the Phase 9a stub) ----

    /**
     * [teamId, status, count] for non-draft items whose product belongs to
     * one of the teams. Drafts are the requester's private workspace and
     * don't count as team workload.
     */
    @Query("""
        SELECT p.team.id, i.status, COUNT(i)
        FROM EstimateRequestItem i, Product p
        WHERE i.productId = p.id AND p.team.id IN :teamIds AND i.status <> com.acme.estimator.estimates.EstimateStatus.DRAFT
        GROUP BY p.team.id, i.status
        """)
    List<Object[]> countItemsByTeamAndStatus(@Param("teamIds") List<Long> teamIds);

    /**
     * Approved items with reporting context: [item, teamId, productName,
     * requestTitle]. Hours/cost are computed in the service from each
     * item's phase-line snapshot at its approved complexity.
     */
    @Query("""
        SELECT i, p.team.id, p.name, r.title
        FROM EstimateRequestItem i, Product p, EstimateRequest r
        WHERE i.productId = p.id AND r.id = i.estimateRequestId
          AND p.team.id IN :teamIds AND i.status = com.acme.estimator.estimates.EstimateStatus.APPROVED
        """)
    List<Object[]> findApprovedItemsWithContextByTeamIds(@Param("teamIds") List<Long> teamIds);
}
