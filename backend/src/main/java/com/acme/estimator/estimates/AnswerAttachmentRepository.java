package com.acme.estimator.estimates;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnswerAttachmentRepository extends JpaRepository<AnswerAttachment, Long> {

    Optional<AnswerAttachment> findByItemIdAndQuestionId(Long itemId, Long questionId);

    List<AnswerAttachment> findAllByItemId(Long itemId);

    void deleteByItemIdAndQuestionId(Long itemId, Long questionId);

    /** Metadata-only query — excludes the file_data column for lightweight listing. */
    @Query("""
        SELECT new com.acme.estimator.estimates.dto.AttachmentMeta(
            a.id, a.itemId, a.questionId, a.originalFilename, a.contentType, a.fileSizeBytes, a.uploadedAt
        )
        FROM AnswerAttachment a
        WHERE a.itemId = :itemId
        """)
    List<com.acme.estimator.estimates.dto.AttachmentMeta> findMetaByItemId(@Param("itemId") Long itemId);
}
