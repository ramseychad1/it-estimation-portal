package com.acme.estimator.teams.dto;

import com.acme.estimator.audit.ChangeLogEntry;
import java.time.OffsetDateTime;

public record TeamHistoryItem(
    Long id,
    String action,
    String fieldName,
    String oldValue,
    String newValue,
    Long changedBy,
    OffsetDateTime changedAt,
    String notes
) {
    public static TeamHistoryItem from(ChangeLogEntry entry) {
        return new TeamHistoryItem(
            entry.getId(),
            entry.getAction().name(),
            entry.getFieldName(),
            entry.getOldValue(),
            entry.getNewValue(),
            entry.getChangedBy(),
            entry.getChangedAt(),
            entry.getNotes()
        );
    }
}
