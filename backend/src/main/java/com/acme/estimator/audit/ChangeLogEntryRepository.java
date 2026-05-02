package com.acme.estimator.audit;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface ChangeLogEntryRepository
    extends JpaRepository<ChangeLogEntry, Long>, JpaSpecificationExecutor<ChangeLogEntry> {

    /**
     * Per-entity history for the small drawer in the Teams / Phases pages.
     * Bounded query — full Change Log screen comes via the Specification API.
     */
    List<ChangeLogEntry> findByEntityTypeAndEntityIdOrderByChangedAtDesc(
        String entityType, Long entityId
    );

    /** Used by the eventual Change Log screen. */
    Page<ChangeLogEntry> findByEntityType(String entityType, Pageable pageable);

    // ---- filter-option queries (Phase 4 Change Log viewer) -----------------
    //
    // These power /api/admin/change-log/filters. They return the universe of
    // values that ever wrote a row, regardless of any current filter state —
    // otherwise the dropdowns empty out as the user narrows the date range.

    @Query("select distinct e.entityType from ChangeLogEntry e order by e.entityType")
    List<String> findDistinctEntityTypes();

    @Query("select distinct e.action from ChangeLogEntry e")
    List<ChangeAction> findDistinctActions();

    @Query("select distinct e.changedBy from ChangeLogEntry e")
    List<Long> findDistinctActorIds();

    /**
     * Phase 7 dashboard: {@code myRecentActivity} stat card. Counts rows
     * an actor authored after the given cutoff (typically NOW − 7 days).
     */
    long countByChangedByAndChangedAtAfter(Long changedBy, java.time.OffsetDateTime cutoff);
}
