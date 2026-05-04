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
}
