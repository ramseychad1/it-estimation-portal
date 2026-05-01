package com.acme.estimator.phases.dto;

import com.acme.estimator.audit.ChangeLogEntry;
import java.time.OffsetDateTime;

public record SdlcPhaseHistoryItem(
    Long id,
    String action,
    String fieldName,
    String oldValue,
    String newValue,
    Long changedBy,
    OffsetDateTime changedAt,
    String notes
) {
    public static SdlcPhaseHistoryItem from(ChangeLogEntry entry) {
        return new SdlcPhaseHistoryItem(
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
