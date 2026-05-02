package com.acme.estimator.estimates;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface EstimateRequestRepository
    extends JpaRepository<EstimateRequest, Long>, JpaSpecificationExecutor<EstimateRequest> {

    Page<EstimateRequest> findByRequesterIdOrderByCreatedAtDesc(Long requesterId, Pageable pageable);

    Page<EstimateRequest> findByRequesterIdAndStatusOrderByCreatedAtDesc(
        Long requesterId, EstimateStatus status, Pageable pageable
    );

    /** Strict ownership: 404 if not owned by this requester, no leak. */
    Optional<EstimateRequest> findByIdAndRequesterId(Long id, Long requesterId);

    /** Phase 6b's review queue. */
    Page<EstimateRequest> findByStatusOrderBySubmittedAtAsc(EstimateStatus status, Pageable pageable);
}
