package com.acme.estimator.catalog.questions;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.dto.CreateQuestionRequest;
import com.acme.estimator.catalog.questions.dto.ListQuestionsFilter;
import com.acme.estimator.catalog.questions.dto.QuestionDetail;
import com.acme.estimator.catalog.questions.dto.QuestionListItem;
import com.acme.estimator.catalog.questions.dto.UpdateQuestionRequest;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.common.ApiException;
import jakarta.persistence.criteria.Predicate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CriticalQuestionService {

    /**
     * Reorder pass-one offset. Same value/intent as the SDLC reorder.
     * Questions don't carry a UNIQUE constraint on display_order today,
     * so a single-pass write would also be correct — but matching the
     * SDLC pattern keeps the future option open of adding a partial
     * unique index on (parent, display_order) without re-wiring this
     * service.
     */
    private static final int REORDER_PARK_OFFSET = 10_000;

    private final CriticalQuestionRepository questionRepository;
    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    // ---- reads: in-context lists ---------------------------------------

    @Transactional(readOnly = true)
    public List<QuestionListItem> listByProduct(Long productId) {
        Product parent = productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));
        return questionRepository.findByProductIdOrderByDisplayOrder(productId).stream()
            .map(q -> QuestionListItem.from(q, parent.getName(), null, null))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<QuestionListItem> listBySubFeature(Long subFeatureId) {
        SubFeature parent = subFeatureRepository.findById(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + subFeatureId + " not found"));
        Product grandparent = productRepository.findById(parent.getProductId()).orElse(null);
        Long grandparentId = grandparent == null ? null : grandparent.getId();
        String grandparentName = grandparent == null ? null : grandparent.getName();
        return questionRepository.findBySubFeatureIdOrderByDisplayOrder(subFeatureId).stream()
            .map(q -> QuestionListItem.from(q, parent.getName(), grandparentId, grandparentName))
            .toList();
    }

    // ---- reads: cross-catalog browser ----------------------------------

    @Transactional(readOnly = true)
    public Page<QuestionListItem> listAll(ListQuestionsFilter filter, Pageable pageable) {
        Page<CriticalQuestion> page = questionRepository.findAll(buildSpec(filter), pageable);
        return page.map(this::toListItem);
    }

    @Transactional(readOnly = true)
    public QuestionDetail get(Long id) {
        CriticalQuestion q = findOrThrow(id);
        return toDetail(q);
    }

    @Transactional(readOnly = true)
    public List<ChangeLogEntry> history(Long id) {
        get(id); // 404 if missing
        return changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(CriticalQuestion.ENTITY_TYPE, id);
    }

    // ---- writes --------------------------------------------------------

    @Transactional
    public QuestionDetail createForProduct(Long productId, CreateQuestionRequest req, User actor) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));

        assertTeamAccess(actor, product);

        // Reject when the product has any active sub-features. Otherwise the
        // question's parent-vs-children semantics would be ambiguous —
        // requesters would have to answer it for every sub-feature, but the
        // question lives at the parent. Force the SO to attach the question
        // to a specific sub-feature instead.
        long activeSubs = subFeatureRepository.countByProductIdAndActiveTrue(productId);
        if (activeSubs > 0) {
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "PRODUCT_HAS_SUB_FEATURES",
                "Cannot add a question directly to a product that has active sub-features. "
                + "Attach the question to one of the sub-features instead."
            );
        }

        int nextOrder = questionRepository.findMaxDisplayOrderForProduct(productId) + 1;

        CriticalQuestion q = new CriticalQuestion();
        q.setProductId(productId);
        q.setQuestionText(req.questionText().trim());
        q.setHelpText(blankToNull(req.helpText()));
        q.setRequired(req.required() != null && req.required());
        q.setDocumentUploadEnabled(req.documentUploadEnabled() != null && req.documentUploadEnabled());
        q.setDocumentUploadRequired(req.documentUploadRequired() != null && req.documentUploadRequired());
        q.setActive(req.active() == null ? true : req.active());
        q.setDisplayOrder(nextOrder);
        q.setCreatedBy(actor.getId());
        q.setUpdatedBy(actor.getId());
        CriticalQuestion saved = questionRepository.save(q);

        auditService.recordCreated(CriticalQuestion.ENTITY_TYPE, saved.getId(), actor, null);
        return QuestionDetail.from(saved, product.getName(), null, null);
    }

    @Transactional
    public QuestionDetail createForSubFeature(Long subFeatureId, CreateQuestionRequest req, User actor) {
        SubFeature sub = subFeatureRepository.findById(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + subFeatureId + " not found"));

        Product parentProduct = productRepository.findById(sub.getProductId()).orElse(null);
        assertTeamAccess(actor, parentProduct);

        int nextOrder = questionRepository.findMaxDisplayOrderForSubFeature(subFeatureId) + 1;

        CriticalQuestion q = new CriticalQuestion();
        q.setSubFeatureId(subFeatureId);
        q.setQuestionText(req.questionText().trim());
        q.setHelpText(blankToNull(req.helpText()));
        q.setRequired(req.required() != null && req.required());
        q.setDocumentUploadEnabled(req.documentUploadEnabled() != null && req.documentUploadEnabled());
        q.setDocumentUploadRequired(req.documentUploadRequired() != null && req.documentUploadRequired());
        q.setActive(req.active() == null ? true : req.active());
        q.setDisplayOrder(nextOrder);
        q.setCreatedBy(actor.getId());
        q.setUpdatedBy(actor.getId());
        CriticalQuestion saved = questionRepository.save(q);

        auditService.recordCreated(CriticalQuestion.ENTITY_TYPE, saved.getId(), actor, null);

        Product grandparent = productRepository.findById(sub.getProductId()).orElse(null);
        return QuestionDetail.from(
            saved, sub.getName(),
            grandparent == null ? null : grandparent.getId(),
            grandparent == null ? null : grandparent.getName()
        );
    }

    @Transactional
    public QuestionDetail update(Long id, UpdateQuestionRequest req, User actor) {
        CriticalQuestion q = findOrThrow(id);
        assertTeamAccessForQuestion(actor, q);

        boolean dirty = false;

        if (req.questionText() != null) {
            String next = req.questionText().trim();
            if (auditService.recordUpdated(
                CriticalQuestion.ENTITY_TYPE, q.getId(), "questionText",
                q.getQuestionText(), next, actor
            )) {
                q.setQuestionText(next);
                dirty = true;
            }
        }

        if (req.helpText() != null) {
            String next = blankToNull(req.helpText());
            if (auditService.recordUpdated(
                CriticalQuestion.ENTITY_TYPE, q.getId(), "helpText",
                q.getHelpText(), next, actor
            )) {
                q.setHelpText(next);
                dirty = true;
            }
        }

        if (req.required() != null && req.required() != q.isRequired()) {
            auditService.recordUpdated(
                CriticalQuestion.ENTITY_TYPE, q.getId(), "required",
                String.valueOf(q.isRequired()), String.valueOf(req.required()), actor
            );
            q.setRequired(req.required());
            dirty = true;
        }

        if (req.documentUploadEnabled() != null && req.documentUploadEnabled() != q.isDocumentUploadEnabled()) {
            auditService.recordUpdated(
                CriticalQuestion.ENTITY_TYPE, q.getId(), "documentUploadEnabled",
                String.valueOf(q.isDocumentUploadEnabled()), String.valueOf(req.documentUploadEnabled()), actor
            );
            q.setDocumentUploadEnabled(req.documentUploadEnabled());
            if (!req.documentUploadEnabled()) {
                q.setDocumentUploadRequired(false);
            }
            dirty = true;
        }

        if (req.documentUploadRequired() != null && req.documentUploadRequired() != q.isDocumentUploadRequired()) {
            auditService.recordUpdated(
                CriticalQuestion.ENTITY_TYPE, q.getId(), "documentUploadRequired",
                String.valueOf(q.isDocumentUploadRequired()), String.valueOf(req.documentUploadRequired()), actor
            );
            q.setDocumentUploadRequired(req.documentUploadRequired());
            dirty = true;
        }

        if (dirty) {
            q.setUpdatedBy(actor.getId());
            questionRepository.save(q);
        }
        return toDetail(q);
    }

    @Transactional
    public QuestionDetail activate(Long id, User actor) {
        CriticalQuestion q = findOrThrow(id);
        if (q.isActive()) return toDetail(q);
        q.setActive(true);
        q.setUpdatedBy(actor.getId());
        questionRepository.save(q);
        auditService.recordActivated(CriticalQuestion.ENTITY_TYPE, q.getId(), actor);
        return toDetail(q);
    }

    @Transactional
    public QuestionDetail deactivate(Long id, User actor) {
        CriticalQuestion q = findOrThrow(id);
        if (!q.isActive()) return toDetail(q);
        q.setActive(false);
        q.setUpdatedBy(actor.getId());
        questionRepository.save(q);
        auditService.recordDeactivated(CriticalQuestion.ENTITY_TYPE, q.getId(), actor);
        return toDetail(q);
    }

    /**
     * Standard delete — no typed-name confirmation. Questions are smaller
     * surface than Products / SubFeatures and a basic ConfirmModal is
     * sufficient on the client; the service just hard-deletes and writes
     * a single DELETED audit row.
     */
    @Transactional
    public void delete(Long id, User actor) {
        CriticalQuestion q = findOrThrow(id);
        assertTeamAccessForQuestion(actor, q);
        Long qid = q.getId();
        questionRepository.delete(q);
        auditService.recordDeleted(CriticalQuestion.ENTITY_TYPE, qid, actor, null);
    }

    /**
     * Reorder questions within a single parent (Product OR SubFeature).
     * Two-pass write: park each question at a high offset, then write
     * 1..N. Matches the SDLC pattern; see {@link #REORDER_PARK_OFFSET}.
     *
     * Only writes a REORDERED change_log row for questions whose
     * display_order actually changed — quiet operations don't pollute
     * the audit feed.
     */
    @Transactional
    public List<QuestionListItem> reorderForProduct(Long productId, List<Long> questionIds, User actor) {
        Product parent = productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));
        assertTeamAccess(actor, parent);
        List<CriticalQuestion> current =
            questionRepository.findByProductIdOrderByDisplayOrder(productId);
        applyReorder(current, questionIds, actor);
        return questionRepository.findByProductIdOrderByDisplayOrder(productId).stream()
            .map(q -> QuestionListItem.from(q, parent.getName(), null, null))
            .toList();
    }

    @Transactional
    public List<QuestionListItem> reorderForSubFeature(Long subFeatureId, List<Long> questionIds, User actor) {
        SubFeature parent = subFeatureRepository.findById(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + subFeatureId + " not found"));
        Product grandparent = productRepository.findById(parent.getProductId()).orElse(null);
        assertTeamAccess(actor, grandparent);
        Long gid = grandparent == null ? null : grandparent.getId();
        String gname = grandparent == null ? null : grandparent.getName();

        List<CriticalQuestion> current =
            questionRepository.findBySubFeatureIdOrderByDisplayOrder(subFeatureId);
        applyReorder(current, questionIds, actor);
        return questionRepository.findBySubFeatureIdOrderByDisplayOrder(subFeatureId).stream()
            .map(q -> QuestionListItem.from(q, parent.getName(), gid, gname))
            .toList();
    }

    private void applyReorder(List<CriticalQuestion> current, List<Long> requested, User actor) {
        validateReorderRequest(requested, current);

        Map<Long, CriticalQuestion> byId = new HashMap<>();
        Map<Long, Integer> oldOrders = new HashMap<>();
        for (CriticalQuestion q : current) {
            byId.put(q.getId(), q);
            oldOrders.put(q.getId(), q.getDisplayOrder());
        }

        // Pass 1: park.
        for (CriticalQuestion q : current) {
            q.setDisplayOrder(REORDER_PARK_OFFSET + q.getDisplayOrder());
        }
        questionRepository.saveAllAndFlush(current);

        // Pass 2: write final 1..N.
        for (int i = 0; i < requested.size(); i++) {
            CriticalQuestion q = byId.get(requested.get(i));
            q.setDisplayOrder(i + 1);
            q.setUpdatedBy(actor.getId());
        }
        List<CriticalQuestion> saved = questionRepository.saveAllAndFlush(
            requested.stream().map(byId::get).toList()
        );

        // Audit: only rows whose order actually moved.
        for (CriticalQuestion q : saved) {
            int oldOrder = oldOrders.get(q.getId());
            if (oldOrder != q.getDisplayOrder()) {
                auditService.recordReordered(
                    CriticalQuestion.ENTITY_TYPE, q.getId(), oldOrder, q.getDisplayOrder(), actor
                );
            }
        }
    }

    private void validateReorderRequest(List<Long> requested, List<CriticalQuestion> current) {
        Set<Long> currentIds = new HashSet<>();
        for (CriticalQuestion q : current) currentIds.add(q.getId());

        Set<Long> requestedSet = new HashSet<>(requested);
        if (requested.size() != requestedSet.size()) {
            throw ApiException.badRequest("Reorder list contains duplicate question ids.");
        }
        if (!currentIds.equals(requestedSet)) {
            throw ApiException.badRequest(
                "Reorder list must contain exactly the current set of question ids for this parent."
            );
        }
    }

    // ---- helpers -------------------------------------------------------

    private void assertTeamAccess(User actor, Product product) {
        if (actor.isAdmin()) return;
        Long teamId = product != null && product.getTeam() != null ? product.getTeam().getId() : null;
        if (teamId == null || !userRepository.findTeamIdsByUserId(actor.getId()).contains(teamId)) {
            throw ApiException.forbidden(
                "You can only manage questions for products belonging to your teams."
            );
        }
    }

    private void assertTeamAccessForQuestion(User actor, CriticalQuestion q) {
        if (actor.isAdmin()) return;
        Product product = null;
        if (q.getProductId() != null) {
            product = productRepository.findById(q.getProductId()).orElse(null);
        } else if (q.getSubFeatureId() != null) {
            SubFeature sub = subFeatureRepository.findById(q.getSubFeatureId()).orElse(null);
            if (sub != null) {
                product = productRepository.findById(sub.getProductId()).orElse(null);
            }
        }
        assertTeamAccess(actor, product);
    }

    private CriticalQuestion findOrThrow(Long id) {
        return questionRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Question " + id + " not found"));
    }

    private QuestionDetail toDetail(CriticalQuestion q) {
        ParentInfo p = resolveParent(q);
        return QuestionDetail.from(q, p.parentName, p.grandparentProductId, p.grandparentProductName);
    }

    private QuestionListItem toListItem(CriticalQuestion q) {
        ParentInfo p = resolveParent(q);
        return QuestionListItem.from(q, p.parentName, p.grandparentProductId, p.grandparentProductName);
    }

    private record ParentInfo(String parentName, Long grandparentProductId, String grandparentProductName) {}

    private ParentInfo resolveParent(CriticalQuestion q) {
        if (q.getProductId() != null) {
            String name = productRepository.findById(q.getProductId())
                .map(Product::getName).orElse("Deleted product");
            return new ParentInfo(name, null, null);
        }
        if (q.getSubFeatureId() != null) {
            SubFeature sub = subFeatureRepository.findById(q.getSubFeatureId()).orElse(null);
            if (sub == null) return new ParentInfo("Deleted sub-feature", null, null);
            Product gp = productRepository.findById(sub.getProductId()).orElse(null);
            return new ParentInfo(
                sub.getName(),
                gp == null ? null : gp.getId(),
                gp == null ? null : gp.getName()
            );
        }
        return new ParentInfo("(orphaned)", null, null);
    }

    private Specification<CriticalQuestion> buildSpec(ListQuestionsFilter filter) {
        ListQuestionsFilter f = filter == null
            ? new ListQuestionsFilter(null, null, null, null) : filter;
        String query = f.search() == null ? null : f.search().trim();

        return (root, cq, cb) -> {
            Predicate p = cb.conjunction();
            if (query != null && !query.isEmpty()) {
                String like = "%" + query.toLowerCase() + "%";
                p = cb.and(p, cb.or(
                    cb.like(cb.lower(root.get("questionText")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("helpText"), "")), like)
                ));
            }
            if ("Product".equals(f.parentType())) {
                p = cb.and(p, cb.isNotNull(root.get("productId")));
            } else if ("SubFeature".equals(f.parentType())) {
                p = cb.and(p, cb.isNotNull(root.get("subFeatureId")));
            }
            if (f.requiredOnly() != null) {
                p = cb.and(p, cb.equal(root.get("required"), f.requiredOnly()));
            }
            if (f.activeOnly() != null) {
                p = cb.and(p, cb.equal(root.get("active"), f.activeOnly()));
            }
            return p;
        };
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
