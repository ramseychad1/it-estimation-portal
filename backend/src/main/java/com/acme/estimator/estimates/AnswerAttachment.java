package com.acme.estimator.estimates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Uploaded file attached to a requester's answer for a document-upload question.
 *
 * Keyed by (estimate_request_item_id, critical_question_id) — one file per
 * question per item. Binary payload is isolated here so answer-text queries
 * never drag file data through the JPA session.
 */
@Entity
@Table(name = "answer_attachments")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class AnswerAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "estimate_request_item_id", nullable = false, updatable = false)
    private Long itemId;

    @Column(name = "critical_question_id", nullable = false, updatable = false)
    private Long questionId;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size_bytes", nullable = false)
    private long fileSizeBytes;

    @Column(name = "file_data", nullable = false)
    private byte[] fileData;

    @Column(name = "uploaded_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime uploadedAt;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;
}
