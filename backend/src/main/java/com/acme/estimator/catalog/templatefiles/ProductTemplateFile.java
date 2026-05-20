package com.acme.estimator.catalog.templatefiles;

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
 * Binary payload for the downloadable template file attached to a Product.
 * Isolated from the Product entity so catalog list queries never drag file
 * data through the JPA session. One row per product (UNIQUE on product_id).
 */
@Entity
@Table(name = "product_template_files")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class ProductTemplateFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "product_id", nullable = false, updatable = false, unique = true)
    private Long productId;

    @Column(name = "original_filename", nullable = false, length = 255)
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
