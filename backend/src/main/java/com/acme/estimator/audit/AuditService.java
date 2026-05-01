package com.acme.estimator.audit;

import com.acme.estimator.auth.User;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes change_log rows. Always called from a service method that already
 * owns a transaction — REQUIRED propagation means audit rows roll back
 * together with the entity write if anything fails.
 *
 * No reflection, no aspect, no annotation magic. Service code computes its
 * own diff and tells AuditService what to record. That keeps the audit trail
 * legible and makes it obvious in code review when something is being
 * intentionally not recorded.
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private final ChangeLogEntryRepository repository;

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordCreated(String entityType, Long entityId, User actor, String notes) {
        save(entityType, entityId, ChangeAction.CREATED, null, null, null, actor, notes);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordDeleted(String entityType, Long entityId, User actor, String notes) {
        save(entityType, entityId, ChangeAction.DELETED, null, null, null, actor, notes);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordActivated(String entityType, Long entityId, User actor) {
        save(entityType, entityId, ChangeAction.ACTIVATED, null, null, null, actor, null);
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordDeactivated(String entityType, Long entityId, User actor) {
        save(entityType, entityId, ChangeAction.DEACTIVATED, null, null, null, actor, null);
    }

    /**
     * Records an UPDATED row only when {@code oldValue} and {@code newValue}
     * actually differ (string equality with null treated as equal-to-null).
     * Returns true if a row was written, so callers can decide whether to
     * tell the user "no changes saved" — but Phase 2 just relies on the
     * empty diff producing zero rows.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public boolean recordUpdated(
        String entityType,
        Long entityId,
        String fieldName,
        String oldValue,
        String newValue,
        User actor
    ) {
        if (Objects.equals(oldValue, newValue)) return false;
        save(entityType, entityId, ChangeAction.UPDATED, fieldName, oldValue, newValue, actor, null);
        return true;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void recordReordered(
        String entityType, Long entityId, Integer oldOrder, Integer newOrder, User actor
    ) {
        if (Objects.equals(oldOrder, newOrder)) return;
        save(
            entityType, entityId, ChangeAction.REORDERED,
            "display_order",
            oldOrder == null ? null : String.valueOf(oldOrder),
            newOrder == null ? null : String.valueOf(newOrder),
            actor, null
        );
    }

    private void save(
        String entityType,
        Long entityId,
        ChangeAction action,
        String fieldName,
        String oldValue,
        String newValue,
        User actor,
        String notes
    ) {
        ChangeLogEntry entry = new ChangeLogEntry();
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setAction(action);
        entry.setFieldName(fieldName);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setChangedBy(actor.getId());
        entry.setSource(ChangeSource.WEB);
        entry.setNotes(notes);
        repository.save(entry);
    }
}
