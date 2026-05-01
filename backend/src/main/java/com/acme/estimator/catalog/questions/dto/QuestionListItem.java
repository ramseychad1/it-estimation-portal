package com.acme.estimator.catalog.questions.dto;

import com.acme.estimator.catalog.questions.CriticalQuestion;
import java.time.OffsetDateTime;

/**
 * Each row carries enough parent attribution that the cross-catalog
 * browser can show "Sub-feature 'Variant A' on Product 'Mobile App'"
 * without a second round trip per row. The service resolves names in
 * batch before assembling the response.
 */
public record QuestionListItem(
    Long id,
    String parentType,
    Long parentId,
    String parentName,
    /** When parentType=SubFeature, the SubFeature's parent product. Null otherwise. */
    Long grandparentProductId,
    String grandparentProductName,
    String questionText,
    String helpText,
    boolean required,
    int displayOrder,
    boolean active,
    OffsetDateTime updatedAt,
    Long updatedBy,
    OffsetDateTime createdAt,
    Long createdBy
) {
    public static QuestionListItem from(
        CriticalQuestion q,
        String parentName,
        Long grandparentProductId,
        String grandparentProductName
    ) {
        return new QuestionListItem(
            q.getId(),
            q.getParentType(),
            q.getProductId() != null ? q.getProductId() : q.getSubFeatureId(),
            parentName,
            grandparentProductId,
            grandparentProductName,
            q.getQuestionText(),
            q.getHelpText(),
            q.isRequired(),
            q.getDisplayOrder(),
            q.isActive(),
            q.getUpdatedAt(),
            q.getUpdatedBy(),
            q.getCreatedAt(),
            q.getCreatedBy()
        );
    }
}
