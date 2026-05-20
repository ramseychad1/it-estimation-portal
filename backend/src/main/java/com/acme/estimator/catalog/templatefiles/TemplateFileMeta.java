package com.acme.estimator.catalog.templatefiles;

import java.time.OffsetDateTime;

/**
 * Lightweight metadata returned in ProductDetail / SubFeatureDetail and upload
 * responses. Does NOT include the binary payload — use the download endpoint.
 */
public record TemplateFileMeta(
    Long id,
    String originalFilename,
    String contentType,
    long fileSizeBytes,
    OffsetDateTime uploadedAt,
    Long uploadedBy
) {
    public static TemplateFileMeta from(ProductTemplateFile f) {
        return new TemplateFileMeta(
            f.getId(), f.getOriginalFilename(), f.getContentType(),
            f.getFileSizeBytes(), f.getUploadedAt(), f.getUploadedBy()
        );
    }

    public static TemplateFileMeta from(SubFeatureTemplateFile f) {
        return new TemplateFileMeta(
            f.getId(), f.getOriginalFilename(), f.getContentType(),
            f.getFileSizeBytes(), f.getUploadedAt(), f.getUploadedBy()
        );
    }
}
