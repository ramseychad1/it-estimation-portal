package com.acme.estimator.users.dto;

import com.acme.estimator.audit.ChangeLogEntry;
import java.time.OffsetDateTime;

public record UserHistoryItem(
    Long id,
    String action,
    String fieldName,
    String oldValue,
    String newValue,
    Long changedBy,
    OffsetDateTime changedAt,
    String notes
) {
    public static UserHistoryItem from(ChangeLogEntry e) {
        return new UserHistoryItem(
            e.getId(),
            e.getAction().name(),
            e.getFieldName(),
            e.getOldValue(),
            e.getNewValue(),
            e.getChangedBy(),
            e.getChangedAt(),
            e.getNotes()
        );
    }
}
