package com.acme.estimator.catalog.questions;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Question asked of the requester before an estimate is generated.
 * Attaches to either a Product OR a SubFeature, never both. The XOR
 * constraint is enforced by the DB CHECK; service code asserts it too
 * before save (defence in depth).
 */
@Entity
@Table(name = "critical_questions")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class CriticalQuestion {

    public static final String ENTITY_TYPE = "CriticalQuestion";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    /** Set when parent is a Product. Mutually exclusive with {@link #subFeatureId}. */
    @Column(name = "product_id", updatable = false)
    private Long productId;

    /** Set when parent is a SubFeature. Mutually exclusive with {@link #productId}. */
    @Column(name = "sub_feature_id", updatable = false)
    private Long subFeatureId;

    @Column(name = "question_text", nullable = false)
    private String questionText;

    @Column(name = "help_text")
    private String helpText;

    @Column(name = "required", nullable = false)
    private boolean required = false;

    @Column(name = "document_upload_enabled", nullable = false)
    private boolean documentUploadEnabled = false;

    @Column(name = "document_upload_required", nullable = false)
    private boolean documentUploadRequired = false;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private Long createdBy;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by", nullable = false)
    private Long updatedBy;

    /**
     * "Product" or "SubFeature" — the parent's ENTITY_TYPE.
     *
     * The literals are hard-coded rather than referenced from
     * {@code Product.ENTITY_TYPE} / {@code SubFeature.ENTITY_TYPE} on
     * purpose: importing those classes would add a dependency from
     * {@code catalog.questions} to {@code catalog.products} and
     * {@code catalog.subfeatures}, which is the opposite direction of
     * how the packages should reference each other (parents own
     * children, children don't reach back). The cost is a two-string
     * duplication that any audit-trail diff would catch immediately if
     * either ENTITY_TYPE constant ever changed.
     *
     * Used by the Change Log description renderer so a row reads as
     * "...question on Product 'X'" vs "...question on SubFeature 'Y'".
     */
    @Transient
    public String getParentType() {
        if (productId != null) return "Product";
        if (subFeatureId != null) return "SubFeature";
        // The DB CHECK + service-layer guard ensure we never land here on
        // a persisted row, but tests may construct unsaved instances.
        return null;
    }
}
