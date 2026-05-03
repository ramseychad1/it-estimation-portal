package com.acme.estimator.estimates;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EstimateRequestRepository
    extends JpaRepository<EstimateRequest, Long>, JpaSpecificationExecutor<EstimateRequest> {

    Page<EstimateRequest> findByRequesterIdOrderByCreatedAtDesc(Long requesterId, Pageable pageable);

    Page<EstimateRequest> findByRequesterIdAndStatusOrderByCreatedAtDesc(
        Long requesterId, EstimateStatus status, Pageable pageable
    );

    /** Strict ownership: 404 if not owned by this requester, no leak. */
    Optional<EstimateRequest> findByIdAndRequesterId(Long id, Long requesterId);

    /** Phase 6b's review queue — single-status flavour (legacy of the 6a stub). */
    Page<EstimateRequest> findByStatusOrderBySubmittedAtAsc(EstimateStatus status, Pageable pageable);

    /** Phase 6b's review queue — covers both SUBMITTED and IN_REVIEW so SOs see their claimed work. */
    Page<EstimateRequest> findByStatusInOrderBySubmittedAtAsc(
        List<EstimateStatus> statuses, Pageable pageable
    );

    // ---- Phase 7 dashboard counts -----------------------------------------

    long countByRequesterIdAndStatus(Long requesterId, EstimateStatus status);

    long countByStatus(EstimateStatus status);

    long countByReviewerIdAndStatus(Long reviewerId, EstimateStatus status);

    // ---- Phase 8 reporting ------------------------------------------------

    /**
     * Returns one row per team: [teamId, total, submitted, inReview, approved].
     * Only products with a team assigned are counted; null-team products are excluded.
     */
    @Query(nativeQuery = true, value = """
        SELECT p.team_id,
               COUNT(er.id),
               SUM(CASE WHEN er.status = 'SUBMITTED' THEN 1 ELSE 0 END),
               SUM(CASE WHEN er.status = 'IN_REVIEW' THEN 1 ELSE 0 END),
               SUM(CASE WHEN er.status = 'APPROVED' THEN 1 ELSE 0 END)
        FROM estimate_requests er
        JOIN products p ON er.product_id = p.id
        WHERE p.team_id IN :teamIds
        GROUP BY p.team_id
        """)
    List<Object[]> countRequestsByTeamIdIn(@Param("teamIds") List<Long> teamIds);

    /**
     * Returns one row per approved request: [requestId, teamId, approvedBlendedRateId,
     * onshoreRate, offshoreRate]. Used to compute approved-hours cost per team.
     */
    @Query(nativeQuery = true, value = """
        SELECT er.id, p.team_id, er.approved_blended_rate_id,
               br.onshore_rate, br.offshore_rate
        FROM estimate_requests er
        JOIN products p ON er.product_id = p.id
        LEFT JOIN blended_rates br ON er.approved_blended_rate_id = br.id
        WHERE er.status = 'APPROVED' AND p.team_id IN :teamIds
        """)
    List<Object[]> findApprovedWithRateByTeamIdIn(@Param("teamIds") List<Long> teamIds);

    /** Detail view: most-recently approved requests for a set of product IDs. */
    @Query("""
        SELECT er FROM EstimateRequest er
        WHERE er.status = com.acme.estimator.estimates.EstimateStatus.APPROVED
          AND er.productId IN :productIds
        ORDER BY er.reviewedAt DESC
        """)
    List<EstimateRequest> findRecentApprovedByProductIds(
        @Param("productIds") List<Long> productIds,
        Pageable pageable);
}
