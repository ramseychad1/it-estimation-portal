package com.acme.estimator.estimates;

import java.util.List;
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

    /** Phase 6b's review queue — single-status flavour (legacy of the 6a stub). */
    Page<EstimateRequest> findByStatusOrderBySubmittedAtAsc(EstimateStatus status, Pageable pageable);

    /** Phase 6b's review queue — covers both SUBMITTED and IN_REVIEW so SOs see their claimed work. */
    Page<EstimateRequest> findByStatusInOrderBySubmittedAtAsc(
        List<EstimateStatus> statuses, Pageable pageable
    );
}
