package com.acme.estimator.catalog.subfeatures;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.dto.CreateSubFeatureRequest;
import com.acme.estimator.catalog.templatefiles.CatalogTemplateFileService;
import com.acme.estimator.catalog.templatefiles.TemplateFileMeta;
import com.acme.estimator.catalog.subfeatures.dto.SubFeatureDetail;
import com.acme.estimator.catalog.subfeatures.dto.SubFeatureListItem;
import com.acme.estimator.catalog.subfeatures.dto.UpdateSubFeatureRequest;
import com.acme.estimator.common.ApiException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubFeatureService {

    private final SubFeatureRepository subFeatureRepository;
    private final ProductRepository productRepository;
    private final CriticalQuestionRepository questionRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final CatalogTemplateFileService templateFileService;

    // ---- reads ---------------------------------------------------------

    @Transactional(readOnly = true)
    public List<SubFeatureListItem> listByProduct(Long productId) {
        ensureProductExists(productId);
        return subFeatureRepository.findByProductIdOrderByName(productId).stream()
            .map(this::toListItem)
            .toList();
    }

    @Transactional(readOnly = true)
    public SubFeatureDetail get(Long id) {
        SubFeature s = subFeatureRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + id + " not found"));
        return toDetail(s);
    }

    @Transactional(readOnly = true)
    public List<ChangeLogEntry> history(Long id) {
        get(id); // 404 if missing
        return changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SubFeature.ENTITY_TYPE, id);
    }

    // ---- writes --------------------------------------------------------

    @Transactional
    public SubFeatureDetail create(Long productId, CreateSubFeatureRequest req, User actor) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));

        assertTeamAccess(actor, product);

        // Sub-features only attach to CONTAINER products. ATOMIC products
        // hold a direct estimate template; routing a sub-feature under one
        // would contradict the mode contract.
        if (product.getMode() != ProductMode.CONTAINER) {
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "INVALID_PRODUCT_MODE",
                "Sub-features can only be added to CONTAINER products."
            );
        }

        // Active-name uniqueness within the parent product. (Same scope as
        // Product but bounded by product_id — different products can hold
        // sub-features with the same name.)
        subFeatureRepository
            .findByProductIdAndNameIgnoreCaseAndActiveTrue(productId, req.name().trim())
            .ifPresent(existing -> {
                throw ApiException.conflict(
                    "An active sub-feature named '" + existing.getName()
                    + "' already exists on this product."
                );
            });

        SubFeature s = new SubFeature();
        s.setProductId(productId);
        s.setName(req.name().trim());
        s.setDescription(blankToNull(req.description()));
        s.setActive(req.active() == null ? true : req.active());
        s.setCreatedBy(actor.getId());
        s.setUpdatedBy(actor.getId());
        SubFeature saved = subFeatureRepository.save(s);

        auditService.recordCreated(SubFeature.ENTITY_TYPE, saved.getId(), actor, null);
        return toDetail(saved);
    }

    @Transactional
    public SubFeatureDetail update(Long id, UpdateSubFeatureRequest req, User actor) {
        SubFeature s = subFeatureRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + id + " not found"));

        assertTeamAccessByProductId(actor, s.getProductId());

        // Active-flag flips routed through dedicated endpoints — same rule as
        // Product. Keeps audit-row shape consistent (ACTIVATED / DEACTIVATED).
        if (req.active() != null && req.active() != s.isActive()) {
            throw ApiException.badRequest(
                "Use POST /activate or /deactivate to change a sub-feature's active status."
            );
        }

        // Rename collision: if the new name belongs to another active
        // sub-feature under the same product, reject. Mirrors create-time.
        if (req.name() != null && !req.name().trim().equalsIgnoreCase(s.getName())) {
            subFeatureRepository
                .findByProductIdAndNameIgnoreCaseAndActiveTrue(s.getProductId(), req.name().trim())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(s.getId())) {
                        throw ApiException.conflict(
                            "An active sub-feature named '" + existing.getName()
                            + "' already exists on this product."
                        );
                    }
                });
        }

        boolean dirty = false;

        if (req.name() != null) {
            String newName = req.name().trim();
            if (auditService.recordUpdated(
                SubFeature.ENTITY_TYPE, s.getId(), "name", s.getName(), newName, actor
            )) {
                s.setName(newName);
                dirty = true;
            }
        }

        if (req.description() != null) {
            String newDescription = blankToNull(req.description());
            if (auditService.recordUpdated(
                SubFeature.ENTITY_TYPE, s.getId(), "description",
                s.getDescription(), newDescription, actor
            )) {
                s.setDescription(newDescription);
                dirty = true;
            }
        }

        if (dirty) {
            s.setUpdatedBy(actor.getId());
            subFeatureRepository.save(s);
        }
        return toDetail(s);
    }

    @Transactional
    public SubFeatureDetail activate(Long id, User actor) {
        SubFeature s = subFeatureRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + id + " not found"));
        assertTeamAccessByProductId(actor, s.getProductId());
        if (s.isActive()) return toDetail(s);

        // Reactivation collision — same shape as ProductService.activate.
        subFeatureRepository
            .findByProductIdAndNameIgnoreCaseAndActiveTrue(s.getProductId(), s.getName())
            .ifPresent(existing -> {
                if (!existing.getId().equals(s.getId())) {
                    throw ApiException.conflict(
                        "Cannot reactivate: an active sub-feature named '"
                        + existing.getName() + "' already exists on this product."
                    );
                }
            });

        s.setActive(true);
        s.setUpdatedBy(actor.getId());
        subFeatureRepository.save(s);
        auditService.recordActivated(SubFeature.ENTITY_TYPE, s.getId(), actor);
        return toDetail(s);
    }

    @Transactional
    public SubFeatureDetail deactivate(Long id, User actor) {
        SubFeature s = subFeatureRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + id + " not found"));
        assertTeamAccessByProductId(actor, s.getProductId());
        if (!s.isActive()) return toDetail(s);

        s.setActive(false);
        s.setUpdatedBy(actor.getId());
        subFeatureRepository.save(s);
        auditService.recordDeactivated(SubFeature.ENTITY_TYPE, s.getId(), actor);
        return toDetail(s);
    }

    /**
     * Hard-delete the sub-feature. The DB cascade purges its critical
     * questions and its estimate template. Same audit-trail contract as
     * Product delete: a SINGLE DELETED change_log row at the parent
     * level, no per-child rows. See {@code ProductService.delete} javadoc.
     */
    @Transactional
    public void delete(Long id, String confirmationName, User actor) {
        SubFeature s = subFeatureRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + id + " not found"));

        assertTeamAccessByProductId(actor, s.getProductId());

        if (confirmationName == null
            || !confirmationName.trim().equalsIgnoreCase(s.getName())) {
            throw ApiException.badRequest(
                "Confirmation name does not match the sub-feature's name."
            );
        }

        Long subId = s.getId();
        subFeatureRepository.delete(s);
        auditService.recordDeleted(SubFeature.ENTITY_TYPE, subId, actor, null);
    }

    // ---- helpers --------------------------------------------------------

    private void assertTeamAccess(User actor, Product product) {
        if (actor.isAdmin()) return;
        Long teamId = product.getTeam() != null ? product.getTeam().getId() : null;
        if (teamId == null || !userRepository.findTeamIdsByUserId(actor.getId()).contains(teamId)) {
            throw ApiException.forbidden(
                "You can only manage sub-features for products belonging to your teams."
            );
        }
    }

    private void assertTeamAccessByProductId(User actor, Long productId) {
        if (actor.isAdmin()) return;
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));
        assertTeamAccess(actor, product);
    }

    private void ensureProductExists(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw ApiException.notFound("Product " + productId + " not found");
        }
    }

    private SubFeatureListItem toListItem(SubFeature s) {
        int qc = (int) questionRepository.countBySubFeatureIdAndActiveTrue(s.getId());
        return SubFeatureListItem.from(s, qc);
    }

    private SubFeatureDetail toDetail(SubFeature s) {
        int qc = (int) questionRepository.countBySubFeatureIdAndActiveTrue(s.getId());
        TemplateFileMeta templateFile = templateFileService.getMetaForSubFeature(s.getId()).orElse(null);
        return SubFeatureDetail.from(s, qc, templateFile);
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
