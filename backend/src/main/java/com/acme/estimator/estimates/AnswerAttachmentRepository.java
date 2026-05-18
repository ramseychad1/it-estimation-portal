package com.acme.estimator.estimates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnswerAttachmentRepository extends JpaRepository<AnswerAttachment, Long> {

    List<AnswerAttachment> findAllByItemIdAndQuestionId(Long itemId, Long questionId);

    List<AnswerAttachment> findAllByItemId(Long itemId);

    /** Metadata-only query — excludes the file_data column for lightweight listing. */
    @Query("""
        SELECT new com.acme.estimator.estimates.dto.AttachmentMeta(
            a.id, a.itemId, a.questionId, a.originalFilename, a.contentType, a.fileSizeBytes, a.uploadedAt
        )
        FROM AnswerAttachment a
        WHERE a.itemId = :itemId
        ORDER BY a.uploadedAt ASC
        """)
    List<com.acme.estimator.estimates.dto.AttachmentMeta> findMetaByItemId(@Param("itemId") Long itemId);
}
