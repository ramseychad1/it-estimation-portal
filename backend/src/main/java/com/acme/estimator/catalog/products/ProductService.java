package com.acme.estimator.catalog.products;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.dto.CreateProductRequest;
import com.acme.estimator.catalog.products.dto.ListProductsFilter;
import com.acme.estimator.catalog.products.dto.ProductDetail;
import com.acme.estimator.catalog.products.dto.ProductListItem;
import com.acme.estimator.catalog.products.dto.UpdateProductRequest;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templatefiles.CatalogTemplateFileService;
import com.acme.estimator.catalog.templatefiles.TemplateFileMeta;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;
    private final CriticalQuestionRepository questionRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final AuditService auditService;
    private final CatalogTemplateFileService templateFileService;

    // ---- reads ---------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<ProductListItem> list(ListProductsFilter filter, Pageable pageable) {
        Page<Product> page = productRepository.findAll(buildSpec(filter), pageable);
        return page.map(this::toListItem);
    }

    @Transactional(readOnly = true)
    public ProductExport listForExport(ListProductsFilter filter) {
        List<Product> products = productRepository.findAll(
            buildSpec(filter), Sort.by("name").ascending()
        );
        Set<Long> userIds = new HashSet<>();
        for (Product p : products) {
            if (p.getCreatedBy() != null) userIds.add(p.getCreatedBy());
            if (p.getUpdatedBy() != null) userIds.add(p.getUpdatedBy());
        }
        Map<Long, String> userNames = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u -> userNames.put(u.getId(), u.fullName()));
        return new ProductExport(products, userNames);
    }

    public record ProductExport(List<Product> products, Map<Long, String> userNames) {}

    @Transactional(readOnly = true)
    public ProductDetail get(Long id) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Product " + id + " not found"));
        return toDetail(product);
    }

    @Transactional(readOnly = true)
    public List<ChangeLogEntry> history(Long id) {
        get(id); // 404 if missing
        return changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, id);
    }

    // ---- writes --------------------------------------------------------

    @Transactional
    public ProductDetail create(CreateProductRequest req, User actor) {
        productRepository.findByNameIgnoreCaseAndActiveTrue(req.name().trim())
            .ifPresent(existing -> {
                throw ApiException.conflict(
                    "An active product named '" + existing.getName() + "' already exists."
                );
            });

        Team team = resolveActiveTeam(req.teamId());
        assertTeamAccess(actor, team.getId());

        Product product = new Product();
        product.setName(req.name().trim());
        product.setDescription(blankToNull(req.description()));
        product.setMode(req.mode());
        product.setActive(req.active() == null ? true : req.active());
        product.setTeam(team);
        product.setCreatedBy(actor.getId());
        product.setUpdatedBy(actor.getId());
        Product saved = productRepository.save(product);

        auditService.recordCreated(Product.ENTITY_TYPE, saved.getId(), actor, null);
        return toDetail(saved);
    }

    @Transactional
    public ProductDetail update(Long id, UpdateProductRequest req, User actor) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Product " + id + " not found"));

        assertTeamAccess(actor, product.getTeam() != null ? product.getTeam().getId() : null);

        // Third layer of mode protection: explicit service-level rejection.
        // The DB CHECK constraint and JPA updatable=false would also block
        // a mutation, but we want a friendly 400 IMMUTABLE_FIELD message
        // before either of those fires.
        if (req.mode() != null && req.mode() != product.getMode()) {
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "IMMUTABLE_FIELD",
                "Product mode is locked at creation and cannot be changed."
            );
        }

        // Active flag flips go through dedicated /activate /deactivate
        // endpoints to keep audit-row shape consistent (ACTIVATED /
        // DEACTIVATED rather than UPDATED). Reject quietly-trying-to-flip
        // through PATCH.
        if (req.active() != null && req.active() != product.isActive()) {
            throw ApiException.badRequest(
                "Use POST /activate or /deactivate to change a product's active status."
            );
        }

        // Name uniqueness only applies among ACTIVE products. If the new
        // name collides with another active product, reject; case-insensitive.
        if (req.name() != null && !req.name().trim().equalsIgnoreCase(product.getName())) {
            productRepository.findByNameIgnoreCaseAndActiveTrue(req.name().trim())
                .ifPresent(existing -> {
                    if (!existing.getId().equals(product.getId())) {
                        throw ApiException.conflict(
                            "An active product named '" + existing.getName() + "' already exists."
                        );
                    }
                });
        }

        boolean dirty = false;

        if (req.name() != null) {
            String newName = req.name().trim();
            if (auditService.recordUpdated(
                Product.ENTITY_TYPE, product.getId(), "name", product.getName(), newName, actor
            )) {
                product.setName(newName);
                dirty = true;
            }
        }

        if (req.description() != null) {
            String newDescription = blankToNull(req.description());
            if (auditService.recordUpdated(
                Product.ENTITY_TYPE, product.getId(), "description",
                product.getDescription(), newDescription, actor
            )) {
                product.setDescription(newDescription);
                dirty = true;
            }
        }

        if (req.teamId() != null) {
            Team newTeam = resolveActiveTeam(req.teamId());
            String oldTeamName = product.getTeam() != null ? product.getTeam().getName() : null;
            String newTeamName = newTeam.getName();
            if (!newTeam.getId().equals(product.getTeam() != null ? product.getTeam().getId() : null)) {
                if (auditService.recordUpdated(
                    Product.ENTITY_TYPE, product.getId(), "team", oldTeamName, newTeamName, actor
                )) {
                    product.setTeam(newTeam);
                    dirty = true;
                }
            }
        }

        if (dirty) {
            product.setUpdatedBy(actor.getId());
            productRepository.save(product);
        }
        return toDetail(product);
    }

    @Transactional
    public ProductDetail activate(Long id, User actor) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Product " + id + " not found"));
        assertTeamAccess(actor, product.getTeam() != null ? product.getTeam().getId() : null);
        if (product.isActive()) return toDetail(product);

        // Reactivation collision: refuse to re-activate "Foo" if a different
        // active product is already named "Foo". Mirrors the create-time
        // active-name uniqueness rule. The deactivate-then-recreate flow is
        // explicitly supported (you create a new "Foo" while the old is
        // inactive); this guard catches the inverse "deactivate-then-revive"
        // case where reviving would now conflict.
        productRepository.findByNameIgnoreCaseAndActiveTrue(product.getName())
            .ifPresent(existing -> {
                if (!existing.getId().equals(product.getId())) {
                    throw ApiException.conflict(
                        "Cannot reactivate: an active product named '"
                        + existing.getName() + "' already exists."
                    );
                }
            });

        product.setActive(true);
        product.setUpdatedBy(actor.getId());
        productRepository.save(product);
        auditService.recordActivated(Product.ENTITY_TYPE, product.getId(), actor);
        return toDetail(product);
    }

    @Transactional
    public ProductDetail deactivate(Long id, User actor) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Product " + id + " not found"));
        assertTeamAccess(actor, product.getTeam() != null ? product.getTeam().getId() : null);
        if (!product.isActive()) return toDetail(product);

        product.setActive(false);
        product.setUpdatedBy(actor.getId());
        productRepository.save(product);
        auditService.recordDeactivated(Product.ENTITY_TYPE, product.getId(), actor);
        return toDetail(product);
    }

    /**
     * Hard-delete the product. The DB cascade purges sub-features,
     * critical questions, and any estimate templates. The audit trail
     * captures a SINGLE {@code DELETED} change_log row at the parent
     * level — child rows are NOT generated. The alternative (loop the
     * children and write per-child DELETED rows before the cascade) is
     * more thorough but creates audit-log noise and the parent's
     * deletion is the audit event that matters.
     *
     * <p>{@code confirmationName} must equal the product's name
     * (case-insensitive). The frontend captures the typed name; the
     * service is the authoritative check.
     */
    @Transactional
    public void delete(Long id, String confirmationName, User actor) {
        Product product = productRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Product " + id + " not found"));

        assertTeamAccess(actor, product.getTeam() != null ? product.getTeam().getId() : null);

        if (confirmationName == null
            || !confirmationName.trim().equalsIgnoreCase(product.getName())) {
            throw ApiException.badRequest(
                "Confirmation name does not match the product's name."
            );
        }

        Long productId = product.getId();
        productRepository.delete(product);
        auditService.recordDeleted(Product.ENTITY_TYPE, productId, actor, null);
    }

    // ---- helpers --------------------------------------------------------

    private Specification<Product> buildSpec(ListProductsFilter filter) {
        ListProductsFilter f = filter == null
            ? new ListProductsFilter(null, null, null, null) : filter;
        String query = f.search() == null ? null : f.search().trim();

        return (root, cq, cb) -> {
            Predicate p = cb.conjunction();
            if (query != null && !query.isEmpty()) {
                String like = "%" + query.toLowerCase() + "%";
                p = cb.and(p, cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("description"), "")), like)
                ));
            }
            if (f.mode() != null) {
                p = cb.and(p, cb.equal(root.get("mode"), f.mode()));
            }
            if (f.activeOnly() != null) {
                p = cb.and(p, cb.equal(root.get("active"),
                    f.activeOnly() ? Boolean.TRUE : Boolean.FALSE));
            }
            if (f.teamId() != null) {
                p = cb.and(p, cb.equal(root.get("team").get("id"), f.teamId()));
            }
            return p;
        };
    }

    private void assertTeamAccess(User actor, Long teamId) {
        if (actor.isAdmin()) return;
        if (teamId == null || !userRepository.findTeamIdsByUserId(actor.getId()).contains(teamId)) {
            throw ApiException.forbidden(
                "You can only manage products for teams you are assigned to."
            );
        }
    }

    private Team resolveActiveTeam(Long teamId) {
        Team team = teamRepository.findById(teamId)
            .orElseThrow(() -> ApiException.badRequest("Team " + teamId + " not found."));
        if (!team.isActive()) {
            throw ApiException.badRequest("Team '" + team.getName() + "' is inactive.");
        }
        return team;
    }

    private ProductListItem toListItem(Product p) {
        int subFeatureCount = (int) subFeatureRepository.countByProductIdAndActiveTrue(p.getId());
        int questionCount = (int) questionRepository.countByProductIdAndActiveTrue(p.getId());
        return ProductListItem.from(p, subFeatureCount, questionCount);
    }

    private ProductDetail toDetail(Product p) {
        int subFeatureCount = (int) subFeatureRepository.countByProductIdAndActiveTrue(p.getId());
        int questionCount = (int) questionRepository.countByProductIdAndActiveTrue(p.getId());
        TemplateFileMeta templateFile = templateFileService.getMetaForProduct(p.getId()).orElse(null);
        return ProductDetail.from(p, subFeatureCount, questionCount, templateFile);
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
