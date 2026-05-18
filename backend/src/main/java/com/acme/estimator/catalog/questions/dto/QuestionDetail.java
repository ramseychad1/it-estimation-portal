package com.acme.estimator.catalog.questions.dto;

import com.acme.estimator.catalog.questions.CriticalQuestion;
import java.time.OffsetDateTime;

public record QuestionDetail(
    Long id,
    String parentType,
    Long parentId,
    String parentName,
    Long grandparentProductId,
    String grandparentProductName,
    String questionText,
    String helpText,
    boolean required,
    boolean documentUploadEnabled,
    boolean documentUploadRequired,
    int displayOrder,
    boolean active,
    OffsetDateTime createdAt,
    Long createdBy,
    OffsetDateTime updatedAt,
    Long updatedBy
) {
    public static QuestionDetail from(
        CriticalQuestion q,
        String parentName,
        Long grandparentProductId,
        String grandparentProductName
    ) {
        return new QuestionDetail(
            q.getId(),
            q.getParentType(),
            q.getProductId() != null ? q.getProductId() : q.getSubFeatureId(),
            parentName,
            grandparentProductId,
            grandparentProductName,
            q.getQuestionText(),
            q.getHelpText(),
            q.isRequired(),
            q.isDocumentUploadEnabled(),
            q.isDocumentUploadRequired(),
            q.getDisplayOrder(),
            q.isActive(),
            q.getCreatedAt(),
            q.getCreatedBy(),
            q.getUpdatedAt(),
            q.getUpdatedBy()
        );
    }
}
