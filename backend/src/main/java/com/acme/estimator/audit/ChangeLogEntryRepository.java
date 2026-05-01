package com.acme.estimator.audit;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChangeLogEntryRepository extends JpaRepository<ChangeLogEntry, Long> {

    /**
     * Per-entity history for the small drawer in the Teams / Phases pages.
     * Bounded query — full Change Log screen comes in Phase 4.
     */
    List<ChangeLogEntry> findByEntityTypeAndEntityIdOrderByChangedAtDesc(
        String entityType, Long entityId
    );

    /** Used by the eventual Change Log screen. */
    Page<ChangeLogEntry> findByEntityType(String entityType, Pageable pageable);
}
