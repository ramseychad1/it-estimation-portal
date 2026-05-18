package com.acme.estimator.estimates.dto;

import java.time.OffsetDateTime;

/** Lightweight attachment info returned alongside question answers — no file bytes. */
public record AttachmentMeta(
    Long id,
    Long itemId,
    Long questionId,
    String originalFilename,
    String contentType,
    long fileSizeBytes,
    OffsetDateTime uploadedAt
) {}
