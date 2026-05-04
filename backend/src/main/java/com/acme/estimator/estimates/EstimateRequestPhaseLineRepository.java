package com.acme.estimator.estimates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface EstimateRequestPhaseLineRepository
    extends JpaRepository<EstimateRequestPhaseLine, Long> {

    /**
     * Returns lines ordered by their snapshotted display order — not by
     * the live SDLC phase order, since the request item's snapshot is the
     * authoritative ordering for already-submitted items.
     */
    List<EstimateRequestPhaseLine>
        findAllByItemIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(Long itemId);

    /** Batch-load all phase lines for a set of item IDs. */
    @Query("SELECT l FROM EstimateRequestPhaseLine l WHERE l.itemId IN :itemIds")
    List<EstimateRequestPhaseLine> findByItemIdIn(
        @Param("itemIds") List<Long> itemIds);

    /** Used by revise-and-resubmit and drop: delete the snapshot before re-creating it. */
    @Transactional
    void deleteAllByItemId(Long itemId);
}
