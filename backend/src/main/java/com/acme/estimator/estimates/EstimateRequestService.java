package com.acme.estimator.estimates;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateLine;
import com.acme.estimator.catalog.templates.EstimateTemplateLineRepository;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.AnswerInput;
import com.acme.estimator.estimates.dto.CreateDraftRequest;
import com.acme.estimator.estimates.dto.EstimateRequestAnswerView;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.EstimateRequestListItem;
import com.acme.estimator.estimates.dto.EstimateRequestPhaseLineView;
import com.acme.estimator.estimates.dto.SaveAnswersRequest;
import com.acme.estimator.estimates.dto.UpdateDraftRequest;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.rates.BlendedRateRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read + write side for the Requester workflow.
 *
 * <p><b>Ownership.</b> Every public method takes a {@link User} actor and
 * uses it to scope reads/writes to the caller's own requests via
 * {@link EstimateRequestRepository#findByIdAndRequesterId}. A non-owner
 * lookup returns 404 (not 403) — we don't leak existence of other users'
 * requests. The Reviewer surface (Phase 6b) lives behind a separate set
 * of endpoints with their own auth.
 *
 * <p><b>State machine — Phase 6a only fires DRAFT → SUBMITTED.</b> All
 * mutation methods reject if the request is not in {@link EstimateStatus#DRAFT}
 * (or, for {@link #discard}, also REJECTED). The remaining transitions
 * (IN_REVIEW, APPROVED, REJECTED) belong to Phase 6b.
 *
 * <p><b>Snapshot copy on submit.</b> {@link #submit} runs in one
 * transaction: looks up the active estimate template for the request's
 * parent (Product or Sub-feature), copies every template line into
 * {@code estimate_request_phase_lines} (including snapshotting the SDLC
 * phase name and display order at this moment), snapshots each
 * question's current text into the answer rows, then flips status and
 * sets {@code submitted_at}. The hour values become immutable; future
 * template edits can't rewrite history.
 *
 * <p><b>Audit shape.</b> One row per state transition (CREATED on Draft
 * creation, SUBMITTED on submit, DELETED on discard) and one row per
 * field-level UPDATED for title/description. Answer saves write NO audit
 * rows — they're transient state until submission, and the SUBMITTED
 * row is the audit-worthy event that captures the answers' final form.
 */
@Service
@RequiredArgsConstructor
public class EstimateRequestService {

    private final EstimateRequestRepository requestRepository;
    private final EstimateRequestPhaseLineRepository phaseLineRepository;
    private final EstimateRequestQuestionAnswerRepository answerRepository;
    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;
    private final CriticalQuestionRepository questionRepository;
    private final EstimateTemplateRepository templateRepository;
    private final EstimateTemplateLineRepository templateLineRepository;
    private final SdlcPhaseRepository phaseRepository;
    private final AuditService auditService;
    private final ChangeLogEntryRepository changeLogRepository;
    private final BlendedRateRepository blendedRateRepository;
    private final UserRepository userRepository;

    // ---- reads ---------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<EstimateRequestListItem> myRequests(
        Pageable pageable, EstimateStatus statusFilter, String titleSearch, User requester
    ) {
        // Build a Specification so (status, search) combinations don't
        // explode into N derived query methods. Search is a case-insensitive
        // LIKE on title; null/blank means no filter.
        String search = (titleSearch == null) ? null : titleSearch.trim();
        Long requesterId = requester.getId();
        var spec = (org.springframework.data.jpa.domain.Specification<EstimateRequest>)
            (root, query, cb) -> {
                java.util.List<jakarta.persistence.criteria.Predicate> predicates =
                    new java.util.ArrayList<>();
                predicates.add(cb.equal(root.get("requesterId"), requesterId));
                if (statusFilter != null) {
                    predicates.add(cb.equal(root.get("status"), statusFilter));
                }
                if (search != null && !search.isEmpty()) {
                    predicates.add(cb.like(
                        cb.lower(root.get("title")),
                        "%" + search.toLowerCase() + "%"
                    ));
                }
                return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
            };
        Page<EstimateRequest> page = requestRepository.findAll(spec, pageable);

        // Batch-resolve product + sub-feature names so the list view renders
        // without per-row lookups.
        Set<Long> productIds = page.stream().map(EstimateRequest::getProductId).collect(Collectors.toSet());
        Set<Long> subIds = page.stream().map(EstimateRequest::getSubFeatureId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> productNames = new HashMap<>();
        productRepository.findAllById(productIds).forEach(p -> productNames.put(p.getId(), p.getName()));
        Map<Long, String> subNames = new HashMap<>();
        subFeatureRepository.findAllById(subIds).forEach(s -> subNames.put(s.getId(), s.getName()));

        return page.map(req -> EstimateRequestListItem.from(
            req,
            productNames.getOrDefault(req.getProductId(), "Deleted product"),
            req.getSubFeatureId() == null ? null
                : subNames.getOrDefault(req.getSubFeatureId(), "Deleted sub-feature")
        ));
    }

    @Transactional(readOnly = true)
    public EstimateRequestDetail getMyRequest(Long id, User actor) {
        EstimateRequest request = loadVisibleRequest(id, actor);
        return toDetail(request, actor);
    }

    /**
     * Audit feed for the Activity card on the requester's detail page.
     * Phase 7.5: visible to the requester OR any Admin. Non-owners who
     * aren't Admin get the 404 from {@link #loadVisibleRequest} so we
     * don't leak existence to other Requesters.
     */
    @Transactional(readOnly = true)
    public List<ChangeLogEntry> myRequestHistory(Long id, User actor) {
        loadVisibleRequest(id, actor);
        return changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, id
        );
    }

    // ---- writes --------------------------------------------------------

    @Transactional
    public EstimateRequestDetail createDraft(CreateDraftRequest req, User requester) {
        Product product = productRepository.findById(req.productId())
            .orElseThrow(() -> ApiException.badRequest("Product " + req.productId() + " not found."));
        if (!product.isActive()) {
            throw ApiException.badRequest("Product is not active.");
        }

        Long subFeatureId = null;
        if (product.getMode() == ProductMode.CONTAINER) {
            if (req.subFeatureId() == null) {
                throw ApiException.badRequest(
                    "This is a container product — a sub-feature must be selected."
                );
            }
            SubFeature sub = subFeatureRepository.findById(req.subFeatureId())
                .orElseThrow(() -> ApiException.badRequest(
                    "Sub-feature " + req.subFeatureId() + " not found."
                ));
            if (!sub.getProductId().equals(product.getId())) {
                throw ApiException.badRequest(
                    "Sub-feature does not belong to the chosen product."
                );
            }
            if (!sub.isActive()) {
                throw ApiException.badRequest("Sub-feature is not active.");
            }
            subFeatureId = sub.getId();
        } else {
            // Atomic product: sub-feature must be null.
            if (req.subFeatureId() != null) {
                throw ApiException.badRequest(
                    "Atomic products do not have sub-features — leave subFeatureId null."
                );
            }
        }

        EstimateRequest entity = new EstimateRequest();
        entity.setTitle(req.title().trim());
        entity.setDescription(blankToNull(req.description()));
        entity.setProductId(product.getId());
        entity.setSubFeatureId(subFeatureId);
        entity.setStatus(EstimateStatus.DRAFT);
        entity.setRequesterId(requester.getId());
        EstimateRequest saved = requestRepository.save(entity);

        auditService.recordCreated(EstimateRequest.ENTITY_TYPE, saved.getId(), requester, null);
        return toDetail(saved, requester);
    }

    @Transactional
    public EstimateRequestDetail updateDraft(Long id, UpdateDraftRequest req, User requester) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        requireDraft(request);

        boolean dirty = false;

        if (req.title() != null) {
            String newTitle = req.title().trim();
            if (newTitle.isEmpty()) {
                throw ApiException.badRequest("Title cannot be blank.");
            }
            if (auditService.recordUpdated(
                EstimateRequest.ENTITY_TYPE, request.getId(), "title",
                request.getTitle(), newTitle, requester
            )) {
                request.setTitle(newTitle);
                dirty = true;
            }
        }

        if (req.description() != null) {
            String newDesc = blankToNull(req.description());
            if (auditService.recordUpdated(
                EstimateRequest.ENTITY_TYPE, request.getId(), "description",
                request.getDescription(), newDesc, requester
            )) {
                request.setDescription(newDesc);
                dirty = true;
            }
        }

        if (dirty) requestRepository.save(request);
        return toDetail(request, requester);
    }

    /**
     * Replace-all answers for a Draft. No audit rows — see class javadoc.
     * Validates that every question id belongs to this request's parent.
     */
    @Transactional
    public EstimateRequestDetail saveDraftAnswers(
        Long id, SaveAnswersRequest req, User requester
    ) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        requireDraft(request);

        List<CriticalQuestion> validQuestions = loadQuestionsFor(request);
        Map<Long, CriticalQuestion> validById = validQuestions.stream()
            .collect(Collectors.toMap(CriticalQuestion::getId, q -> q));

        // Detect duplicate question ids inside the body — defence in depth
        // beyond the unique-key the DB would also catch.
        Set<Long> seen = new HashSet<>();
        for (AnswerInput in : req.answers()) {
            if (!seen.add(in.questionId())) {
                throw ApiException.badRequest(
                    "Duplicate questionId in answers: " + in.questionId()
                );
            }
            if (!validById.containsKey(in.questionId())) {
                throw ApiException.badRequest(
                    "Question " + in.questionId() + " does not belong to this request's parent."
                );
            }
        }

        // Replace-all: nuke + insert. The DB unique key on
        // (estimate_request_id, critical_question_id) makes this safe.
        answerRepository.deleteAllByEstimateRequestId(request.getId());
        // flush so DELETE precedes INSERT inside the same transaction; the
        // upcoming saveAll would otherwise race the unique-index check.
        answerRepository.flush();

        List<EstimateRequestQuestionAnswer> rows = new ArrayList<>(req.answers().size());
        for (AnswerInput in : req.answers()) {
            CriticalQuestion q = validById.get(in.questionId());
            String answer = in.answerText() == null ? "" : in.answerText();
            // Skip persisting blank answers — there's no value in storing
            // an empty row, and submit() validates required-question
            // coverage by the presence of a non-blank row.
            if (answer.isBlank()) continue;
            EstimateRequestQuestionAnswer row = new EstimateRequestQuestionAnswer();
            row.setEstimateRequestId(request.getId());
            row.setCriticalQuestionId(q.getId());
            row.setQuestionTextSnapshot(q.getQuestionText());
            row.setAnswerText(answer);
            rows.add(row);
        }
        answerRepository.saveAll(rows);

        return toDetail(request, requester);
    }

    @Transactional
    public EstimateRequestDetail submit(Long id, User requester) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        requireDraft(request);

        // Re-validate the parent is still active — a Draft survives the
        // catalog being mutated underneath it; submit must catch that.
        Product product = productRepository.findById(request.getProductId())
            .orElseThrow(() -> ApiException.badRequest("Product no longer exists."));
        if (!product.isActive()) {
            throw ApiException.badRequest("Product is no longer active — submission blocked.");
        }
        if (request.getSubFeatureId() != null) {
            SubFeature sub = subFeatureRepository.findById(request.getSubFeatureId())
                .orElseThrow(() -> ApiException.badRequest("Sub-feature no longer exists."));
            if (!sub.isActive()) {
                throw ApiException.badRequest(
                    "Sub-feature is no longer active — submission blocked."
                );
            }
        }

        // Required-question coverage. Looks up live questions (the source
        // of truth at submit time) and verifies every required one has a
        // non-blank persisted answer.
        List<CriticalQuestion> liveQuestions = loadQuestionsFor(request);
        Map<Long, EstimateRequestQuestionAnswer> persistedAnswers =
            answerRepository.findAllByEstimateRequestId(request.getId()).stream()
                .collect(Collectors.toMap(
                    EstimateRequestQuestionAnswer::getCriticalQuestionId, a -> a
                ));

        Map<Long, String> missingByQuestionId = new HashMap<>();
        for (CriticalQuestion q : liveQuestions) {
            if (!q.isRequired()) continue;
            EstimateRequestQuestionAnswer answer = persistedAnswers.get(q.getId());
            if (answer == null || answer.getAnswerText() == null
                || answer.getAnswerText().isBlank()) {
                missingByQuestionId.put(q.getId(), q.getQuestionText());
            }
        }
        if (!missingByQuestionId.isEmpty()) {
            // Pack missing question ids into the structured fieldErrors slot
            // so the UI can highlight them precisely. The message names the
            // first missing question for the toast fallback.
            Map<String, String> structured = new HashMap<>();
            missingByQuestionId.forEach(
                (qid, qtext) -> structured.put("question:" + qid, "Required answer is missing.")
            );
            String first = missingByQuestionId.values().iterator().next();
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "MISSING_REQUIRED_ANSWERS",
                "Required questions are unanswered: \"" + first + "\".",
                structured
            );
        }

        // Active template lookup. Sub-feature requests resolve against the
        // sub-feature's template; atomic-product requests against the
        // product's. Either may be missing — that's NO_ACTIVE_TEMPLATE.
        Optional<EstimateTemplate> activeTemplate = (request.getSubFeatureId() != null)
            ? templateRepository.findActiveBySubFeatureId(request.getSubFeatureId())
            : templateRepository.findActiveByProductId(request.getProductId());
        if (activeTemplate.isEmpty()) {
            String parentLabel;
            if (request.getSubFeatureId() != null) {
                parentLabel = "sub-feature '"
                    + subFeatureRepository.findById(request.getSubFeatureId())
                        .map(SubFeature::getName).orElse("(unknown)")
                    + "'";
            } else {
                parentLabel = "product '" + product.getName() + "'";
            }
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "NO_ACTIVE_TEMPLATE",
                "No active estimate template exists for " + parentLabel
                    + ". The Solution Owner must create one before submission."
            );
        }

        EstimateTemplate template = activeTemplate.get();

        // Snapshot the question text into the answer rows now (we don't
        // re-write the answers, but the snapshot column may have drifted
        // since saveDraftAnswers if the question text was edited in
        // between). One UPDATE per row is fine — populations are small.
        Map<Long, String> liveQuestionTextById = liveQuestions.stream()
            .collect(Collectors.toMap(CriticalQuestion::getId, CriticalQuestion::getQuestionText));
        List<EstimateRequestQuestionAnswer> existingAnswerRows =
            answerRepository.findAllByEstimateRequestId(request.getId());
        for (EstimateRequestQuestionAnswer row : existingAnswerRows) {
            String currentText = liveQuestionTextById.get(row.getCriticalQuestionId());
            if (currentText != null && !currentText.equals(row.getQuestionTextSnapshot())) {
                row.setQuestionTextSnapshot(currentText);
            }
        }
        answerRepository.saveAll(existingAnswerRows);

        // Snapshot the template lines into estimate_request_phase_lines.
        // Pull the SDLC phases in one batch so we can capture name +
        // display order alongside.
        List<EstimateTemplateLine> templateLines =
            templateLineRepository.findAllByTemplateId(template.getId());
        Set<Long> phaseIds = templateLines.stream()
            .map(EstimateTemplateLine::getSdlcPhaseId).collect(Collectors.toSet());
        Map<Long, SdlcPhase> phasesById = new HashMap<>();
        phaseRepository.findAllById(phaseIds).forEach(p -> phasesById.put(p.getId(), p));

        List<EstimateRequestPhaseLine> snapshot = new ArrayList<>(templateLines.size());
        for (EstimateTemplateLine src : templateLines) {
            SdlcPhase phase = phasesById.get(src.getSdlcPhaseId());
            EstimateRequestPhaseLine line = new EstimateRequestPhaseLine();
            line.setEstimateRequestId(request.getId());
            line.setSdlcPhaseId(src.getSdlcPhaseId());
            line.setSdlcPhaseNameSnapshot(phase == null ? "(missing phase)" : phase.getName());
            line.setSdlcPhaseDisplayOrderSnapshot(
                phase == null ? Integer.MAX_VALUE : phase.getDisplayOrder()
            );
            line.setOnshoreLow(src.getOnshoreLow());
            line.setOnshoreMed(src.getOnshoreMed());
            line.setOnshoreHigh(src.getOnshoreHigh());
            line.setOffshoreLow(src.getOffshoreLow());
            line.setOffshoreMed(src.getOffshoreMed());
            line.setOffshoreHigh(src.getOffshoreHigh());
            snapshot.add(line);
        }
        phaseLineRepository.saveAll(snapshot);

        request.setTemplateId(template.getId());
        request.setStatus(EstimateStatus.SUBMITTED);
        request.setSubmittedAt(OffsetDateTime.now());
        requestRepository.save(request);

        // Phase 6b: SUBMITTED is its own ChangeAction now. Notes are
        // intentionally null — the request's own template_id captures
        // the snapshot version, no need for a redundant string.
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, request.getId(),
            ChangeAction.SUBMITTED, requester, null
        );

        return toDetail(request, requester);
    }

    @Transactional
    public void discard(Long id, User requester) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        if (request.getStatus() != EstimateStatus.DRAFT
            && request.getStatus() != EstimateStatus.REJECTED) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Draft or Rejected requests can be discarded."
            );
        }
        Long requestId = request.getId();
        requestRepository.delete(request);
        auditService.recordDeleted(EstimateRequest.ENTITY_TYPE, requestId, requester, null);
    }

    // ====================================================================
    // Phase 6b — Reviewer-side methods.
    //
    // Authorization scope is different from the requester surface — these
    // are gated by SOLUTION_OWNER role at the controller (admin sendBack
    // requires ADMIN). Within a request's lifecycle, runtime ownership
    // checks compare reviewer_id to the actor's id for actions that only
    // the claiming SO can take.
    // ====================================================================

    @Transactional(readOnly = true)
    public Page<EstimateRequestListItem> reviewQueue(
        com.acme.estimator.estimates.dto.ListReviewQueueFilter filter,
        Pageable pageable, User reviewer
    ) {
        // Default scope: SUBMITTED + IN_REVIEW. status filter narrows.
        // mineOnly intersects to "claimed by the calling SO."
        Long actorId = reviewer.getId();
        EstimateStatus statusFilter = filter == null ? null : filter.status();
        String search = filter == null || filter.search() == null
            ? null : filter.search().trim();
        Long productFilter = filter == null ? null : filter.productId();
        Long teamFilter = filter == null ? null : filter.teamId();
        boolean mineOnly = filter != null && filter.mineOnly();

        var spec = (org.springframework.data.jpa.domain.Specification<EstimateRequest>)
            (root, query, cb) -> {
                List<jakarta.persistence.criteria.Predicate> ps = new ArrayList<>();
                if (statusFilter != null) {
                    ps.add(cb.equal(root.get("status"), statusFilter));
                } else {
                    ps.add(root.get("status").in(
                        EstimateStatus.SUBMITTED, EstimateStatus.IN_REVIEW
                    ));
                }
                if (search != null && !search.isEmpty()) {
                    ps.add(cb.like(
                        cb.lower(root.get("title")),
                        "%" + search.toLowerCase() + "%"
                    ));
                }
                if (productFilter != null) {
                    ps.add(cb.equal(root.get("productId"), productFilter));
                }
                if (teamFilter != null) {
                    // Subquery: product_id IN (SELECT p.id FROM products p WHERE p.team_id = teamFilter)
                    var sub = query.subquery(Long.class);
                    var prod = sub.from(com.acme.estimator.catalog.products.Product.class);
                    sub.select(prod.get("id"))
                       .where(cb.equal(prod.get("team").get("id"), teamFilter));
                    ps.add(root.get("productId").in(sub));
                }
                if (mineOnly) {
                    ps.add(cb.equal(root.get("reviewerId"), actorId));
                }
                return cb.and(ps.toArray(new jakarta.persistence.criteria.Predicate[0]));
            };
        Page<EstimateRequest> page = requestRepository.findAll(spec, pageable);

        Set<Long> productIds = page.stream().map(EstimateRequest::getProductId).collect(Collectors.toSet());
        Set<Long> subIds = page.stream().map(EstimateRequest::getSubFeatureId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> productNames = new HashMap<>();
        productRepository.findAllById(productIds).forEach(p -> productNames.put(p.getId(), p.getName()));
        Map<Long, String> subNames = new HashMap<>();
        subFeatureRepository.findAllById(subIds).forEach(s -> subNames.put(s.getId(), s.getName()));

        return page.map(req -> EstimateRequestListItem.from(
            req,
            productNames.getOrDefault(req.getProductId(), "Deleted product"),
            req.getSubFeatureId() == null ? null
                : subNames.getOrDefault(req.getSubFeatureId(), "Deleted sub-feature")
        ));
    }

    /**
     * Reviewer-side detail load. Visible on any non-Draft request
     * (Drafts stay private to the requester). Returns the full
     * snapshot data; reviewerStatus on the returned DTO tells the UI
     * which affordances to surface.
     */
    @Transactional(readOnly = true)
    public EstimateRequestDetail getForReview(Long id, User reviewer) {
        EstimateRequest request = requestRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
        if (request.getStatus() == EstimateStatus.DRAFT) {
            // Drafts are private to the requester. Don't leak existence.
            throw ApiException.notFound("Estimate request " + id + " not found.");
        }
        return toDetail(request, reviewer);
    }

    @Transactional
    public EstimateRequestDetail startReview(Long id, User reviewer) {
        EstimateRequest request = requestRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));

        // Idempotent if the SAME SO calls it on a request they already
        // claimed — return the current detail without writing a duplicate
        // REVIEW_STARTED row.
        if (request.getStatus() == EstimateStatus.IN_REVIEW
            && reviewer.getId().equals(request.getReviewerId())) {
            return toDetail(request, reviewer);
        }

        // 409 ALREADY_IN_REVIEW with the other SO's name when a different
        // SO has it. The name lets the UI render the right race-condition
        // banner instead of a generic toast.
        if (request.getStatus() == EstimateStatus.IN_REVIEW) {
            String otherName = userRepository.findById(request.getReviewerId())
                .map(User::fullName).orElse("another reviewer");
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "ALREADY_IN_REVIEW",
                otherName + " is currently reviewing this request."
            );
        }
        if (request.getStatus() != EstimateStatus.SUBMITTED) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Submitted requests can enter review."
            );
        }

        request.setStatus(EstimateStatus.IN_REVIEW);
        request.setReviewerId(reviewer.getId());
        requestRepository.save(request);
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, request.getId(),
            ChangeAction.REVIEW_STARTED, reviewer, null
        );
        return toDetail(request, reviewer);
    }

    /**
     * Release an In-Review claim. Normally only the current reviewer
     * can release. Phase 7.5 carve-out: an Admin can release a review
     * claimed by any other SO — the same safety-valve rationale as
     * {@link #sendBack}, but for the in-flight state. The actor on the
     * audit row is whoever performed the release (admin or reviewer).
     */
    @Transactional
    public EstimateRequestDetail releaseReview(Long id, User actor) {
        EstimateRequest request = requestRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
        if (request.getStatus() != EstimateStatus.IN_REVIEW) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only In Review requests can be released."
            );
        }
        if (!actor.isAdmin() && !actor.getId().equals(request.getReviewerId())) {
            throw new ApiException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                "NOT_THE_REVIEWER",
                "Only the current reviewer can release this request."
            );
        }
        request.setStatus(EstimateStatus.SUBMITTED);
        request.setReviewerId(null);
        requestRepository.save(request);
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, request.getId(),
            ChangeAction.REVIEW_RELEASED, actor, null
        );
        return toDetail(request, actor);
    }

    @Transactional
    public EstimateRequestDetail saveReviewState(
        Long id, com.acme.estimator.estimates.dto.SaveReviewStateRequest req, User reviewer
    ) {
        EstimateRequest request = requireInReviewByActor(id, reviewer);

        if (req.complexity() != null || (req.justification() == null && req.lineOverrides() == null)) {
            // complexity provided OR an "explicit clear of complexity" — allow set.
            // Note: null in the DTO means "no change" per class doc.
            request.setComplexity(req.complexity() != null ? req.complexity() : request.getComplexity());
        }
        if (req.justification() != null) {
            String trimmed = req.justification().trim();
            request.setJustification(trimmed.isEmpty() ? null : trimmed);
        }
        requestRepository.save(request);

        if (req.lineOverrides() != null && !req.lineOverrides().isEmpty()) {
            List<EstimateRequestPhaseLine> lines = phaseLineRepository
                .findAllByEstimateRequestIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(request.getId());
            Map<Long, EstimateRequestPhaseLine> byPhaseId = lines.stream()
                .collect(Collectors.toMap(
                    EstimateRequestPhaseLine::getSdlcPhaseId, l -> l
                ));
            for (var ov : req.lineOverrides()) {
                EstimateRequestPhaseLine line = byPhaseId.get(ov.sdlcPhaseId());
                if (line == null) {
                    throw ApiException.badRequest(
                        "Override sdlcPhaseId " + ov.sdlcPhaseId()
                            + " is not part of this request's snapshot."
                    );
                }
                line.setOnshoreOverride(ov.onshoreOverride());
                line.setOffshoreOverride(ov.offshoreOverride());
            }
            phaseLineRepository.saveAll(lines);
        }
        // No audit row — autosaves are transient until approve/reject.
        return toDetail(request, reviewer);
    }

    @Transactional
    public EstimateRequestDetail approve(Long id, User reviewer) {
        EstimateRequest request = requireInReviewByActor(id, reviewer);

        if (request.getComplexity() == null) {
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "MISSING_COMPLEXITY",
                "Pick a complexity before approving."
            );
        }
        if (request.getJustification() == null || request.getJustification().isBlank()) {
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "MISSING_JUSTIFICATION",
                "Add a justification before approving."
            );
        }

        // Snapshot the blended-rate row effective today. Total cost is
        // computed client-side, but this id keeps the cost banner
        // accurate ("uses blended rates effective {date}") even after
        // future rate updates.
        BlendedRate currentRate = blendedRateRepository
            .findCurrentAsOf(LocalDate.now())
            .orElse(null);
        request.setApprovedBlendedRateId(currentRate == null ? null : currentRate.getId());
        request.setStatus(EstimateStatus.APPROVED);
        request.setReviewedAt(OffsetDateTime.now());
        requestRepository.save(request);

        String notes = "Approved with complexity=" + request.getComplexity()
            + (currentRate != null ? ", blended rate id=" + currentRate.getId() : "");
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, request.getId(),
            ChangeAction.APPROVED, reviewer, notes
        );
        return toDetail(request, reviewer);
    }

    @Transactional
    public EstimateRequestDetail reject(
        Long id, com.acme.estimator.estimates.dto.RejectRequest req, User reviewer
    ) {
        EstimateRequest request = requireInReviewByActor(id, reviewer);
        String justification = req.justification() == null ? "" : req.justification().trim();
        if (justification.isEmpty()) {
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "MISSING_JUSTIFICATION",
                "Reject requires a justification."
            );
        }
        request.setJustification(justification);
        request.setStatus(EstimateStatus.REJECTED);
        request.setReviewedAt(OffsetDateTime.now());
        requestRepository.save(request);

        String preview = justification.length() > 100
            ? justification.substring(0, 100) + "…"
            : justification;
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, request.getId(),
            ChangeAction.REJECTED, reviewer, "Rejected. Reason: " + preview
        );
        return toDetail(request, reviewer);
    }

    /**
     * Admin-only safety valve: send an Approved or Rejected request
     * back to Submitted so a different SO can re-review it.
     *
     * <p><b>What gets cleared:</b> reviewer_id, reviewed_at, complexity,
     * justification, approved_blended_rate_id, AND every per-line
     * onshore/offshore override.
     *
     * <p><b>Why clear the overrides?</b> The overrides are <em>review
     * state</em>, not <em>snapshot data</em>. The snapshot is the L/M/H
     * grid copied at submission — that's immutable history. The
     * overrides are "this reviewer's adjustments to L/M/H based on this
     * reviewer's reading of the answers"; carrying them forward to the
     * next reviewer would taint their judgment. Sending back means
     * starting the review fresh.
     */
    @Transactional
    public EstimateRequestDetail sendBack(
        Long id, com.acme.estimator.estimates.dto.SendBackRequest req, User actor
    ) {
        EstimateRequest request = requestRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
        if (request.getStatus() != EstimateStatus.APPROVED
            && request.getStatus() != EstimateStatus.REJECTED) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Approved or Rejected requests can be sent back."
            );
        }
        String reason = req.reason() == null ? "" : req.reason().trim();
        if (reason.isEmpty()) {
            throw ApiException.badRequest("Send-back requires a reason.");
        }

        request.setReviewerId(null);
        request.setReviewedAt(null);
        request.setComplexity(null);
        request.setJustification(null);
        request.setApprovedBlendedRateId(null);
        request.setStatus(EstimateStatus.SUBMITTED);
        requestRepository.save(request);

        // Clear per-line overrides — see method javadoc.
        List<EstimateRequestPhaseLine> lines = phaseLineRepository
            .findAllByEstimateRequestIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(request.getId());
        for (var line : lines) {
            line.setOnshoreOverride(null);
            line.setOffshoreOverride(null);
        }
        phaseLineRepository.saveAll(lines);

        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, request.getId(),
            ChangeAction.SENT_BACK, actor, "Sent back. Reason: " + reason
        );
        return toDetail(request, actor);
    }

    /**
     * Reviewer-side guard: request must exist, be In Review, and be
     * claimed by the calling actor. Used by saveReviewState / approve /
     * reject — every action that only the current reviewer can take.
     *
     * <p>Phase 7.5 carve-out: an Admin can perform any of these actions
     * on a request claimed by any other SO. This is the "Admin override"
     * companion to {@link #sendBack}: an Admin shouldn't have to claim
     * the review just to push it through (or stop it). The audit row
     * still attributes the action to the Admin actor — the actor is the
     * actor; reviewer_id stays as it was so we don't lose the SO who
     * was on the hook.
     */
    private EstimateRequest requireInReviewByActor(Long id, User actor) {
        EstimateRequest request = requestRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
        if (request.getStatus() != EstimateStatus.IN_REVIEW) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Request must be In Review for this action."
            );
        }
        if (!actor.isAdmin() && !actor.getId().equals(request.getReviewerId())) {
            throw new ApiException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                "NOT_THE_REVIEWER",
                "Only the current reviewer can perform this action."
            );
        }
        return request;
    }

    // ---- helpers --------------------------------------------------------

    /**
     * Strict-owner load. Used for MUTATIONS on Drafts (PATCH /
     * saveDraftAnswers / submit / discard). Phase 7.5 deliberately does
     * NOT broaden this to Admin: Drafts are private workspace, and even
     * an Admin cannot edit-as-user. Admin can VIEW everything via
     * {@link #loadVisibleRequest}; admin cannot mutate someone else's
     * Draft.
     *
     * <p>The 404 (not 403) is the privacy posture inherited from Phase
     * 6a — Requesters cannot discover other Requesters' request ids by
     * probing the endpoint.
     */
    private EstimateRequest requireOwnedRequest(Long id, User requester) {
        return requestRepository.findByIdAndRequesterId(id, requester.getId())
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
    }

    /**
     * Visibility-load: GET-side counterpart to {@link #requireOwnedRequest}.
     *
     * <p>Phase 7.5: Admins inherit Requester authority and can VIEW any
     * estimate request, regardless of ownership. Non-Admin non-owners
     * get the privacy 404 — same shape as before, so the Requester
     * surface keeps its "no leakage of other users' request ids" posture.
     */
    private EstimateRequest loadVisibleRequest(Long id, User actor) {
        if (actor.isAdmin()) {
            return requestRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
        }
        return requireOwnedRequest(id, actor);
    }

    private void requireDraft(EstimateRequest request) {
        if (request.getStatus() != EstimateStatus.DRAFT) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Draft requests can be modified."
            );
        }
    }

    private List<CriticalQuestion> loadQuestionsFor(EstimateRequest request) {
        // Surface only ACTIVE questions for answering. Inactive questions
        // (deactivated by the SO between draft creation and submit) drop
        // out of the required set so the requester isn't blocked.
        if (request.getSubFeatureId() != null) {
            return questionRepository
                .findBySubFeatureIdOrderByDisplayOrder(request.getSubFeatureId())
                .stream().filter(CriticalQuestion::isActive).toList();
        }
        return questionRepository
            .findByProductIdOrderByDisplayOrder(request.getProductId())
            .stream().filter(CriticalQuestion::isActive).toList();
    }

    EstimateRequestDetail toDetail(EstimateRequest request, User actor) {
        Product product = productRepository.findById(request.getProductId()).orElse(null);
        SubFeature subFeature = (request.getSubFeatureId() == null) ? null
            : subFeatureRepository.findById(request.getSubFeatureId()).orElse(null);

        Integer templateVersion = null;
        if (request.getTemplateId() != null) {
            templateVersion = templateRepository.findById(request.getTemplateId())
                .map(EstimateTemplate::getVersionNumber).orElse(null);
        }

        // Reviewer fields — derived per-actor. The reviewerStatus value
        // ("you" / "other-so" / "unclaimed") lets the UI decide which
        // affordances to surface without re-deriving the relationship.
        String reviewerName = null;
        String reviewerStatus;
        if (request.getReviewerId() == null) {
            reviewerStatus = "unclaimed";
        } else if (request.getReviewerId().equals(actor.getId())) {
            reviewerStatus = "you";
            reviewerName = actor.fullName();
        } else {
            reviewerStatus = "other-so";
            reviewerName = userRepository.findById(request.getReviewerId())
                .map(User::fullName).orElse("Deleted user");
        }

        // Phase lines come from the snapshot table for SUBMITTED+; for
        // DRAFT this is empty.
        List<EstimateRequestPhaseLineView> lines = phaseLineRepository
            .findAllByEstimateRequestIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(request.getId())
            .stream().map(l -> new EstimateRequestPhaseLineView(
                l.getSdlcPhaseId(),
                l.getSdlcPhaseNameSnapshot(),
                l.getSdlcPhaseDisplayOrderSnapshot(),
                l.getOnshoreLow(), l.getOnshoreMed(), l.getOnshoreHigh(),
                l.getOffshoreLow(), l.getOffshoreMed(), l.getOffshoreHigh(),
                l.getOnshoreOverride(), l.getOffshoreOverride()
            )).toList();

        // Answers: render in the order the questions appear (display
        // order on the parent), pulling required-flag from the live
        // question (not the snapshot — required is a metadata signal,
        // not part of the contract).
        List<CriticalQuestion> liveQuestions = loadQuestionsFor(request);
        Map<Long, EstimateRequestQuestionAnswer> answerRows =
            answerRepository.findAllByEstimateRequestId(request.getId()).stream()
                .collect(Collectors.toMap(
                    EstimateRequestQuestionAnswer::getCriticalQuestionId, a -> a
                ));
        List<EstimateRequestAnswerView> answers = new ArrayList<>();
        for (CriticalQuestion q : liveQuestions) {
            EstimateRequestQuestionAnswer row = answerRows.get(q.getId());
            answers.add(new EstimateRequestAnswerView(
                q.getId(),
                // Prefer the snapshot text once submitted (history-correct);
                // fall back to live text for Draft.
                row != null && request.getStatus() != EstimateStatus.DRAFT
                    ? row.getQuestionTextSnapshot()
                    : q.getQuestionText(),
                q.isRequired(),
                row == null ? "" : row.getAnswerText()
            ));
        }
        // Surface answer rows whose question was hard-deleted (cascade
        // RESTRICT prevents this, but defensive). They render with the
        // snapshot text so historical view stays coherent.
        Set<Long> liveQuestionIds = liveQuestions.stream()
            .map(CriticalQuestion::getId).collect(Collectors.toSet());
        for (EstimateRequestQuestionAnswer row : answerRows.values()) {
            if (!liveQuestionIds.contains(row.getCriticalQuestionId())) {
                answers.add(new EstimateRequestAnswerView(
                    row.getCriticalQuestionId(),
                    row.getQuestionTextSnapshot(),
                    false,
                    row.getAnswerText()
                ));
            }
        }

        String teamName = (product != null && product.getTeam() != null)
            ? product.getTeam().getName() : null;

        return new EstimateRequestDetail(
            request.getId(),
            request.getTitle(),
            request.getDescription(),
            request.getProductId(),
            product == null ? "Deleted product" : product.getName(),
            teamName,
            request.getSubFeatureId(),
            subFeature == null ? null : subFeature.getName(),
            request.getTemplateId(),
            templateVersion,
            request.getComplexity(),
            request.getStatus(),
            request.getRequesterId(),
            request.getReviewerId(),
            reviewerName,
            reviewerStatus,
            request.getJustification(),
            request.getSubmittedAt(),
            request.getReviewedAt(),
            request.getApprovedBlendedRateId(),
            request.getCreatedAt(),
            request.getUpdatedAt(),
            lines,
            answers
        );
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
