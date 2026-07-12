package com.acme.estimator.catalog.templatefiles;

import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.common.ApiException;
import java.io.IOException;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class CatalogTemplateFileService {

    private static final long MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    private static final Set<String> ALLOWED_TYPES = Set.of(
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    private final ProductTemplateFileRepository productFileRepo;
    private final SubFeatureTemplateFileRepository subFeatureFileRepo;
    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;
    private final UserRepository userRepository;

    // ---- product --------------------------------------------------------

    /** Upload (or replace) the template file for a product. */
    @Transactional
    public TemplateFileMeta uploadForProduct(Long productId, MultipartFile file, User actor) {
        assertProductAccess(productId, actor);
        validateFile(file);
        byte[] bytes = readBytes(file);

        // Upsert: delete existing before saving new one.
        productFileRepo.deleteByProductId(productId);

        ProductTemplateFile entity = new ProductTemplateFile();
        entity.setProductId(productId);
        entity.setOriginalFilename(sanitizeFilename(file.getOriginalFilename()));
        entity.setContentType(file.getContentType());
        entity.setFileSizeBytes(bytes.length);
        entity.setFileData(bytes);
        entity.setUploadedBy(actor.getId());

        return TemplateFileMeta.from(productFileRepo.save(entity));
    }

    /** Delete the template file for a product. No-ops if no file exists. */
    @Transactional
    public void deleteForProduct(Long productId, User actor) {
        assertProductAccess(productId, actor);
        productFileRepo.deleteByProductId(productId);
    }

    /** Stream the product template file. Open to authenticated users (requesters need it in Phase 2). */
    @Transactional(readOnly = true)
    public ProductTemplateFile downloadForProduct(Long productId) {
        return productFileRepo.findByProductId(productId)
            .orElseThrow(() -> ApiException.notFound("No template file found for product " + productId + "."));
    }

    /** Returns metadata only — no binary. Returns empty when no file is attached. */
    @Transactional(readOnly = true)
    public Optional<TemplateFileMeta> getMetaForProduct(Long productId) {
        return productFileRepo.findByProductId(productId).map(TemplateFileMeta::from);
    }

    // ---- sub-feature ----------------------------------------------------

    /** Upload (or replace) the template file for a sub-feature. */
    @Transactional
    public TemplateFileMeta uploadForSubFeature(Long subFeatureId, MultipartFile file, User actor) {
        assertSubFeatureAccess(subFeatureId, actor);
        validateFile(file);
        byte[] bytes = readBytes(file);

        subFeatureFileRepo.deleteBySubFeatureId(subFeatureId);

        SubFeatureTemplateFile entity = new SubFeatureTemplateFile();
        entity.setSubFeatureId(subFeatureId);
        entity.setOriginalFilename(sanitizeFilename(file.getOriginalFilename()));
        entity.setContentType(file.getContentType());
        entity.setFileSizeBytes(bytes.length);
        entity.setFileData(bytes);
        entity.setUploadedBy(actor.getId());

        return TemplateFileMeta.from(subFeatureFileRepo.save(entity));
    }

    /** Delete the template file for a sub-feature. No-ops if no file exists. */
    @Transactional
    public void deleteForSubFeature(Long subFeatureId, User actor) {
        assertSubFeatureAccess(subFeatureId, actor);
        subFeatureFileRepo.deleteBySubFeatureId(subFeatureId);
    }

    /** Stream the sub-feature template file. */
    @Transactional(readOnly = true)
    public SubFeatureTemplateFile downloadForSubFeature(Long subFeatureId) {
        return subFeatureFileRepo.findBySubFeatureId(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("No template file found for sub-feature " + subFeatureId + "."));
    }

    /** Returns metadata only — no binary. Returns empty when no file is attached. */
    @Transactional(readOnly = true)
    public Optional<TemplateFileMeta> getMetaForSubFeature(Long subFeatureId) {
        return subFeatureFileRepo.findBySubFeatureId(subFeatureId).map(TemplateFileMeta::from);
    }

    // ---- helpers --------------------------------------------------------

    /**
     * WEB-02: template-file mutations must be team-scoped like every other
     * catalog mutation. Loads the product, verifies existence, and enforces
     * team access (Admin bypasses).
     */
    private void assertProductAccess(Long productId, User actor) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found."));
        assertTeamAccess(actor, product.getTeam() != null ? product.getTeam().getId() : null);
    }

    private void assertSubFeatureAccess(Long subFeatureId, User actor) {
        SubFeature sub = subFeatureRepository.findById(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + subFeatureId + " not found."));
        Product product = productRepository.findById(sub.getProductId())
            .orElseThrow(() -> ApiException.notFound(
                "Product for sub-feature " + subFeatureId + " not found."));
        assertTeamAccess(actor, product.getTeam() != null ? product.getTeam().getId() : null);
    }

    private void assertTeamAccess(User actor, Long teamId) {
        if (actor.isAdmin()) return;
        if (teamId == null || !userRepository.findTeamIdsByUserId(actor.getId()).contains(teamId)) {
            throw ApiException.forbidden(
                "You can only manage template files for teams you are assigned to.");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw ApiException.badRequest("Uploaded file is empty.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("File exceeds the 10 MB limit.");
        }
        String ct = file.getContentType();
        if (ct == null || !ALLOWED_TYPES.contains(ct)) {
            throw ApiException.badRequest(
                "Unsupported file type. Allowed: PDF, Word (DOCX/DOC), Excel (XLSX/XLS).");
        }
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read uploaded file.");
        }
    }

    private String sanitizeFilename(String name) {
        return (name != null && !name.isBlank()) ? name : "template";
    }
}
