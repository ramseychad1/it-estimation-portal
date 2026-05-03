package com.acme.estimator.estimates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EstimateRequestPhaseLineRepository
    extends JpaRepository<EstimateRequestPhaseLine, Long> {

    /**
     * Returns lines ordered by their snapshotted display order — not by
     * the live SDLC phase order, since the request's snapshot is the
     * authoritative ordering for already-submitted requests.
     */
    List<EstimateRequestPhaseLine>
        findAllByEstimateRequestIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(Long estimateRequestId);

    /** Batch-load all phase lines for a set of estimate request IDs (reporting). */
    @Query("SELECT l FROM EstimateRequestPhaseLine l WHERE l.estimateRequestId IN :requestIds")
    List<EstimateRequestPhaseLine> findByEstimateRequestIdIn(
        @Param("requestIds") List<Long> requestIds);
}
