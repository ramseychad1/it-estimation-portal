package com.acme.estimator.estimates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EstimateRequestPhaseLineRepository
    extends JpaRepository<EstimateRequestPhaseLine, Long> {

    /**
     * Returns lines ordered by their snapshotted display order — not by
     * the live SDLC phase order, since the request's snapshot is the
     * authoritative ordering for already-submitted requests.
     */
    List<EstimateRequestPhaseLine>
        findAllByEstimateRequestIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(Long estimateRequestId);
}
