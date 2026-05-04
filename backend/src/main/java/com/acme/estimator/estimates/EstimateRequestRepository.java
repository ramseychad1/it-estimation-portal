package com.acme.estimator.estimates;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EstimateRequestRepository
    extends JpaRepository<EstimateRequest, Long>, JpaSpecificationExecutor<EstimateRequest> {

    /** Strict ownership: 404 if not owned by this requester, no leak. */
    Optional<EstimateRequest> findByIdAndRequesterId(Long id, Long requesterId);

    // ---- Dashboard counts (Phase 9b M4) -------------------------------------

    /**
     * Count requests where the requester owns ALL items and ALL items are DRAFT
     * (i.e., the request has never been submitted at all).
     */
    @Query(nativeQuery = true, value = """
        SELECT COUNT(DISTINCT er.id) FROM estimate_requests er
        WHERE er.requester_id = :requesterId
        AND NOT EXISTS (
            SELECT 1 FROM estimate_request_items i
            WHERE i.estimate_request_id = er.id AND i.status != 'DRAFT'
        )
        AND EXISTS (
            SELECT 1 FROM estimate_request_items i WHERE i.estimate_request_id = er.id
        )
        """)
    long countDraftsByRequesterId(@Param("requesterId") Long requesterId);

    /**
     * Count requests owned by this requester that have at least one REJECTED item
     * (derived status = NEEDS_REVISION). Used for the Requester dashboard card.
     */
    @Query(nativeQuery = true, value = """
        SELECT COUNT(DISTINCT er.id) FROM estimate_requests er
        WHERE er.requester_id = :requesterId
        AND EXISTS (
            SELECT 1 FROM estimate_request_items i
            WHERE i.estimate_request_id = er.id AND i.status = 'REJECTED'
        )
        """)
    long countNeedsRevisionByRequesterId(@Param("requesterId") Long requesterId);
}
