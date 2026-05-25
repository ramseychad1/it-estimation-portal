package com.acme.estimator.estimates;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.categories.Category;
import com.acme.estimator.catalog.categories.CategoryRepository;
import com.acme.estimator.clientpricing.ClientPricingService;
import com.acme.estimator.clientpricing.dto.EffectivePricingDto;
import com.acme.estimator.clients.Client;
import com.acme.estimator.clients.ClientRepository;
import com.acme.estimator.programs.Program;
import com.acme.estimator.programs.ProgramRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.programtypes.ProgramType;
import com.acme.estimator.catalog.programtypes.ProgramTypeRepository;
import java.util.stream.Stream;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateLine;
import com.acme.estimator.catalog.templates.EstimateTemplateLineRepository;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.AttachmentMeta;
import com.acme.estimator.estimates.dto.AnswerInput;
import com.acme.estimator.estimates.dto.CreateDraftRequest;
import com.acme.estimator.estimates.dto.CreateItemRequest;
import com.acme.estimator.estimates.dto.EstimateRequestAnswerView;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.EstimateRequestItemDto;
import com.acme.estimator.estimates.dto.EstimateRequestListItem;
import com.acme.estimator.estimates.dto.EstimateRequestPhaseLineView;
import com.acme.estimator.estimates.dto.ApproveItemRequest;
import com.acme.estimator.estimates.dto.LineOverrideInput;
import com.acme.estimator.estimates.dto.RejectItemRequest;
import com.acme.estimator.estimates.dto.ReviseAndResubmitRequest;
import com.acme.estimator.estimates.dto.SaveAnswersRequest;
import com.acme.estimator.estimates.dto.UpdateDraftRequest;
import com.acme.estimator.estimates.dto.RequestPricingReviewRequest;
import com.acme.estimator.estimates.dto.AddScopeItemRequest;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.rates.BlendedRateRepository;
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
import com.acme.estimator.notifications.ClarificationRespondedEvent;
import com.acme.estimator.notifications.ItemApprovedEvent;
import com.acme.estimator.notifications.ItemNeedsClarificationEvent;
import com.acme.estimator.notifications.ItemRecalledEvent;
import com.acme.estimator.notifications.ItemRejectedEvent;
import com.acme.estimator.notifications.ItemSentBackEvent;
import com.acme.estimator.notifications.ItemSubmittedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read + write side for the Requester and Reviewer workflows.
 *
 * <p>Phase 9b: per-item review. Each {@link EstimateRequestItem} is
 * reviewed independently by the SO whose team owns the item's product.
 * Team-scoping is a hard authorization check on start/approve/reject.
 *
 * <p><b>Ownership.</b> Requester-side mutations on Drafts use strict
 * {@link #requireOwnedRequest} (owner only). GETs use {@link
 * #loadVisibleRequest} (owner OR admin). Drafts remain private to the
 * requester — even an Admin cannot edit-as-user.
 *
 * <p><b>Admin send-back.</b> Per-item {@link #sendBackItem} (Phase 9b M3).
 * Only APPROVED items can be sent back; REJECTED items are dropped or revised.
 */
@Service
@RequiredArgsConstructor
public class EstimateRequestService {

    private final EstimateRequestRepository requestRepository;
    private final EstimateRequestItemRepository itemRepository;
    private final EstimateRequestPhaseLineRepository phaseLineRepository;
    private final EstimateRequestQuestionAnswerRepository answerRepository;
    private final EstimateRequestProgramTypeRepository requestProgramTypeRepository;
    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;
    private final CriticalQuestionRepository questionRepository;
    private final EstimateTemplateRepository templateRepository;
    private final EstimateTemplateLineRepository templateLineRepository;
    private final SdlcPhaseRepository phaseRepository;
    private final AnswerAttachmentRepository attachmentRepository;
    private final AuditService auditService;
    private final ChangeLogEntryRepository changeLogRepository;
    private final BlendedRateRepository blendedRateRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ProgramTypeRepository programTypeRepository;
    private final ClientRepository clientRepository;
    private final ProgramRepository programRepository;
    private final ClientPricingService clientPricingService;
    private final com.acme.estimator.settings.AppSettingService appSettingService;
    private final ApplicationEventPublisher eventPublisher;

    @org.springframework.beans.factory.annotation.Value("${intake.system-product-id:0}")
    private Long intakeSystemProductId;

    // ---- reads ---------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<EstimateRequestListItem> myRequests(
        Pageable pageable, String statusFilter, String titleSearch,
        User requester, boolean allRequesters
    ) {
        String search = (titleSearch == null) ? null : titleSearch.trim();

        var spec = (org.springframework.data.jpa.domain.Specification<EstimateRequest>)
            (root, query, cb) -> {
                List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
                if (!allRequesters) {
                    predicates.add(cb.equal(root.get("requesterId"), requester.getId()));
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

        // Load items for all requests on the page in one batch
        List<Long> requestIds = page.stream().map(EstimateRequest::getId).toList();
        Map<Long, List<EstimateRequestItem>> itemsByRequestId = loadItemsForRequests(requestIds);

        // Batch-resolve product + sub-feature names
        Map<Long, String> productNames = batchLoadProductNames(itemsByRequestId);
        Map<Long, String> subNames = batchLoadSubNames(itemsByRequestId);

        // Populate requester names only in the all-requesters view; the
        // personal "my requests" surface doesn't need them (the requester is
        // always the current user).
        Map<Long, String> userNames = allRequesters
            ? batchLoadUserNames(page.getContent(), itemsByRequestId)
            : Map.of();

        // Batch-load question counts for the "Questions answered" column.
        Map<Long, Integer> answeredByItemId = batchLoadAnsweredCounts(itemsByRequestId);
        Map<Long, Integer> totalByItemId = batchLoadTotalQuestionCounts(itemsByRequestId);

        // Apply derived status filter in memory (simpler than complex subqueries for M1 scale)
        Page<EstimateRequestListItem> result = page.map(req -> {
            List<EstimateRequestItem> items = itemsByRequestId.getOrDefault(req.getId(), List.of());
            return toListItem(req, items, productNames, subNames, userNames, answeredByItemId, totalByItemId);
        });

        // If status filter is set, filter after mapping
        if (statusFilter != null && !statusFilter.isBlank()) {
            List<EstimateRequestListItem> filtered = result.getContent().stream()
                .filter(li -> statusFilter.equalsIgnoreCase(li.derivedStatus()))
                .toList();
            long total = filtered.size(); // approximate for in-memory filter
            return new org.springframework.data.domain.PageImpl<>(filtered, pageable, total);
        }

        return result;
    }

    @Transactional(readOnly = true)
    public EstimateRequestDetail getMyRequest(Long id, User actor) {
        EstimateRequest request = loadVisibleRequest(id, actor);
        return toDetail(request, actor);
    }

    /**
     * Audit feed for the Activity card on the requester's detail page.
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
        Category category = categoryRepository.findById(req.categoryId())
            .filter(Category::isActive)
            .orElseThrow(() -> ApiException.badRequest("Invalid or inactive category."));

        if (req.programTypeIds() == null || req.programTypeIds().isEmpty()) {
            throw ApiException.badRequest("At least one program type is required.");
        }
        List<Long> distinctPtIds = req.programTypeIds().stream().distinct().toList();
        for (Long ptId : distinctPtIds) {
            programTypeRepository.findById(ptId)
                .filter(ProgramType::isActive)
                .orElseThrow(() -> ApiException.badRequest("Invalid or inactive program type: " + ptId));
        }

        Client client = clientRepository.findById(req.clientId())
            .filter(Client::isActive)
            .orElseThrow(() -> ApiException.badRequest("Invalid or inactive client."));
        Program program = programRepository.findById(req.programId())
            .filter(Program::isActive)
            .orElseThrow(() -> ApiException.badRequest("Invalid or inactive program."));
        if (!program.getClientId().equals(client.getId())) {
            throw ApiException.badRequest("Program does not belong to the selected client.");
        }

        String reqType = (req.requestType() == null || req.requestType().isBlank())
            ? "CATALOG" : req.requestType().toUpperCase();
        if (!"CATALOG".equals(reqType) && !"INTAKE".equals(reqType)) {
            throw ApiException.badRequest("Invalid requestType: must be CATALOG or INTAKE.");
        }
        if ("CATALOG".equals(reqType) && (req.items() == null || req.items().isEmpty())) {
            throw ApiException.badRequest("At least one product item is required for CATALOG requests.");
        }
        if ("INTAKE".equals(reqType) && req.items() != null && !req.items().isEmpty()) {
            throw ApiException.badRequest("INTAKE requests must not include items — products are added by Solution Owners during scoping.");
        }

        EstimateRequest entity = new EstimateRequest();
        entity.setTitle(req.title().trim());
        entity.setDescription(blankToNull(req.description()));
        entity.setGoLiveDate(req.goLiveDate());
        entity.setCategoryId(category.getId());
        entity.setClientId(client.getId());
        entity.setProgramId(program.getId());
        entity.setRequesterId(requester.getId());
        entity.setRequestType(reqType);
        EstimateRequest saved = requestRepository.save(entity);

        for (Long ptId : distinctPtIds) {
            EstimateRequestProgramType erpt = new EstimateRequestProgramType();
            erpt.setRequestId(saved.getId());
            erpt.setProgramTypeId(ptId);
            requestProgramTypeRepository.save(erpt);
        }

        if ("INTAKE".equals(reqType)) {
            // Auto-create the CONTEXT item tied to the configured system intake product.
            if (intakeSystemProductId == null || intakeSystemProductId == 0L) {
                throw ApiException.badRequest(
                    "Generic intake requests are not configured. Contact an administrator to set up the intake product.");
            }
            productRepository.findById(intakeSystemProductId)
                .filter(Product::isActive)
                .orElseThrow(() -> ApiException.badRequest(
                    "Intake system product is not active or not found. Contact an administrator."));
            EstimateRequestItem contextItem = new EstimateRequestItem();
            contextItem.setEstimateRequestId(saved.getId());
            contextItem.setProductId(intakeSystemProductId);
            contextItem.setItemType("SCOPE");
            contextItem.setStatus(EstimateStatus.DRAFT);
            contextItem.setDisplayOrder(0);
            itemRepository.save(contextItem);
        } else {
            // CATALOG: validate and create the requester-selected items
            validateNoDuplicateItems(req.items());
            for (int i = 0; i < req.items().size(); i++) {
                CreateItemRequest itemReq = req.items().get(i);
                EstimateRequestItem item = buildAndValidateItem(itemReq, saved.getId(), i);
                EstimateRequestItem savedItem = itemRepository.save(item);
                if (itemReq.answers() != null && !itemReq.answers().isEmpty()) {
                    saveAnswersForItem(savedItem, itemReq.answers());
                }
            }
        }

        auditService.recordCreated(EstimateRequest.ENTITY_TYPE, saved.getId(), requester, null);
        return toDetail(saved, requester);
    }

    @Transactional
    public EstimateRequestDetail updateDraft(Long id, UpdateDraftRequest req, User requester) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(id);
        requireAllDraft(items);

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

        // goLiveDate: always applied — null means "unknown/clear", not "omitted"
        java.time.LocalDate newGoLiveDate = req.goLiveDate();
        if (!java.util.Objects.equals(request.getGoLiveDate(), newGoLiveDate)) {
            String oldVal = request.getGoLiveDate() != null ? request.getGoLiveDate().toString() : null;
            String newVal = newGoLiveDate != null ? newGoLiveDate.toString() : null;
            auditService.recordUpdated(
                EstimateRequest.ENTITY_TYPE, request.getId(), "goLiveDate", oldVal, newVal, requester
            );
            request.setGoLiveDate(newGoLiveDate);
            dirty = true;
        }

        // categoryId: null = don't change; non-null = update
        if (req.categoryId() != null && !req.categoryId().equals(request.getCategoryId())) {
            categoryRepository.findById(req.categoryId())
                .filter(Category::isActive)
                .orElseThrow(() -> ApiException.badRequest("Invalid or inactive category."));
            auditService.recordUpdated(
                EstimateRequest.ENTITY_TYPE, request.getId(), "category",
                String.valueOf(request.getCategoryId()), String.valueOf(req.categoryId()), requester
            );
            request.setCategoryId(req.categoryId());
            dirty = true;
        }

        // programTypeIds: null = don't change; non-null list must be non-empty
        if (req.programTypeIds() != null) {
            if (req.programTypeIds().isEmpty()) {
                throw ApiException.badRequest("At least one program type is required.");
            }
            List<Long> newPtIds = req.programTypeIds().stream().distinct().sorted().toList();
            for (Long ptId : newPtIds) {
                programTypeRepository.findById(ptId)
                    .filter(ProgramType::isActive)
                    .orElseThrow(() -> ApiException.badRequest("Invalid or inactive program type: " + ptId));
            }
            List<Long> currentPtIds = requestProgramTypeRepository.findByRequestId(request.getId())
                .stream().map(EstimateRequestProgramType::getProgramTypeId).sorted().toList();
            if (!newPtIds.equals(currentPtIds)) {
                auditService.recordUpdated(
                    EstimateRequest.ENTITY_TYPE, request.getId(), "programTypes",
                    currentPtIds.toString(), newPtIds.toString(), requester
                );
                requestProgramTypeRepository.deleteByRequestId(request.getId());
                for (Long ptId : newPtIds) {
                    EstimateRequestProgramType erpt = new EstimateRequestProgramType();
                    erpt.setRequestId(request.getId());
                    erpt.setProgramTypeId(ptId);
                    requestProgramTypeRepository.save(erpt);
                }
                dirty = true;
            }
        }

        // clientId: null = don't change
        if (req.clientId() != null && !req.clientId().equals(request.getClientId())) {
            clientRepository.findById(req.clientId())
                .filter(Client::isActive)
                .orElseThrow(() -> ApiException.badRequest("Invalid or inactive client."));
            auditService.recordUpdated(
                EstimateRequest.ENTITY_TYPE, request.getId(), "client",
                String.valueOf(request.getClientId()), String.valueOf(req.clientId()), requester
            );
            request.setClientId(req.clientId());
            // If client changes, clear program (will be re-set below if provided)
            request.setProgramId(null);
            dirty = true;
        }

        // programId: null = don't change
        if (req.programId() != null && !req.programId().equals(request.getProgramId())) {
            Program program = programRepository.findById(req.programId())
                .filter(Program::isActive)
                .orElseThrow(() -> ApiException.badRequest("Invalid or inactive program."));
            Long effectiveClientId = req.clientId() != null ? req.clientId() : request.getClientId();
            if (!program.getClientId().equals(effectiveClientId)) {
                throw ApiException.badRequest("Program does not belong to the selected client.");
            }
            auditService.recordUpdated(
                EstimateRequest.ENTITY_TYPE, request.getId(), "program",
                String.valueOf(request.getProgramId()), String.valueOf(req.programId()), requester
            );
            request.setProgramId(program.getId());
            dirty = true;
        }

        if (dirty) requestRepository.save(request);
        return toDetail(request, requester);
    }

    /**
     * Replace-all answers for the first item of a Draft.
     * Backward-compatible endpoint — kept for Phase 8 clients.
     */
    @Transactional
    public EstimateRequestDetail saveDraftAnswers(
        Long id, SaveAnswersRequest req, User requester
    ) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(id);
        if (items.isEmpty()) {
            throw ApiException.badRequest("This request has no items.");
        }
        EstimateRequestItem firstItem = items.get(0);
        if (firstItem.getStatus() != EstimateStatus.DRAFT) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Draft requests can be modified."
            );
        }
        performSaveAnswers(firstItem, req.answers());
        return toDetail(request, requester);
    }

    /**
     * Replace-all answers for a specific item. Per-item answer endpoint.
     */
    @Transactional
    public EstimateRequestDetail saveDraftItemAnswers(
        Long requestId, Long itemId, SaveAnswersRequest req, User requester
    ) {
        EstimateRequest request = requireOwnedRequest(requestId, requester);
        EstimateRequestItem item = itemRepository
            .findByIdAndEstimateRequestId(itemId, requestId)
            .orElseThrow(() -> ApiException.notFound(
                "Item " + itemId + " not found on request " + requestId + "."));
        if (item.getStatus() != EstimateStatus.DRAFT) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Draft items can be modified."
            );
        }
        performSaveAnswers(item, req.answers());
        return toDetail(request, requester);
    }

    @Transactional
    public EstimateRequestDetail submit(Long id, User requester) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(id);
        requireAllDraft(items);

        for (EstimateRequestItem item : items) {
            submitItem(item);
        }

        itemRepository.saveAll(items);

        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, request.getId(),
            ChangeAction.SUBMITTED, requester, null
        );

        for (EstimateRequestItem item : items) {
            List<User> soRecipients = sosByProduct(item);
            eventPublisher.publishEvent(new ItemSubmittedEvent(
                request.getId(), request.getTitle(), item.getId(),
                productName(item), soRecipients
            ));
        }

        return toDetail(request, requester);
    }


    @Transactional
    public void discard(Long id, User requester) {
        EstimateRequest request = requireOwnedRequest(id, requester);
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(id);
        String derivedStatus = computeDerivedStatus(items, request);
        if (!"DRAFT".equals(derivedStatus)
                && !"NEEDS_REVISION".equals(derivedStatus)
                && !"NEEDS_CLARIFICATION".equals(derivedStatus)
                && !"RECALLED".equals(derivedStatus)) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Draft, Rejected, Clarification-needed, or Recalled requests can be discarded."
            );
        }
        Long requestId = request.getId();
        requestRepository.delete(request);
        auditService.recordDeleted(EstimateRequest.ENTITY_TYPE, requestId, requester, null);
    }

    // ====================================================================
    // Phase 9b — Per-item review methods.
    // Each item in a multi-product request is reviewed independently.
    // Team-scoping is a hard auth check: SO must be on the product's team.
    // ====================================================================

    @Transactional(readOnly = true)
    public Page<EstimateRequestListItem> reviewQueue(
        com.acme.estimator.estimates.dto.ListReviewQueueFilter filter,
        Pageable pageable, User reviewer
    ) {
        Long actorId = reviewer.getId();
        String statusFilter = filter == null ? null : filter.status();
        String search = filter == null || filter.search() == null
            ? null : filter.search().trim();
        boolean mineOnly = filter != null && filter.mineOnly();
        String requestTypeFilter = filter == null ? null : filter.requestType();

        // Phase 9b M4: compute accessible product IDs for team scoping.
        // Admin sees everything; other SOs see only their teams + no-team products.
        final Set<Long> accessibleProductIds =
            reviewer.isAdmin() ? null : reviewerAccessibleProductIds(actorId);

        // If a non-admin SO has no accessible products, the queue is empty.
        if (accessibleProductIds != null && accessibleProductIds.isEmpty()) {
            return org.springframework.data.domain.Page.empty(pageable);
        }

        // Build spec: requests that have at least one reviewable item visible to this SO
        var spec = (org.springframework.data.jpa.domain.Specification<EstimateRequest>)
            (root, query, cb) -> {
                if (query == null) return cb.conjunction();
                List<jakarta.persistence.criteria.Predicate> ps = new ArrayList<>();

                // Subquery: has at least one SUBMITTED or IN_REVIEW item the SO can see
                var itemSub = query.subquery(Long.class);
                var itemRoot = itemSub.from(EstimateRequestItem.class);
                itemSub.select(itemRoot.get("estimateRequestId"));
                List<jakarta.persistence.criteria.Predicate> itemPredicates = new ArrayList<>();
                itemPredicates.add(cb.equal(itemRoot.get("estimateRequestId"), root.get("id")));

                if (statusFilter != null && !statusFilter.isBlank()) {
                    // Filter to specific item status
                    try {
                        EstimateStatus es = EstimateStatus.valueOf(statusFilter);
                        itemPredicates.add(cb.equal(itemRoot.get("status"), es));
                    } catch (IllegalArgumentException e) {
                        // Unknown status — return empty
                        itemPredicates.add(cb.disjunction());
                    }
                } else {
                    itemPredicates.add(itemRoot.get("status").in(
                        EstimateStatus.SUBMITTED, EstimateStatus.IN_REVIEW
                    ));
                }

                if (mineOnly) {
                    itemPredicates.add(cb.equal(itemRoot.get("reviewerId"), actorId));
                }

                // Team scoping: restrict to products the SO's team owns (or unassigned)
                if (accessibleProductIds != null) {
                    itemPredicates.add(itemRoot.get("productId").in(accessibleProductIds));
                }

                itemSub.where(itemPredicates.toArray(new jakarta.persistence.criteria.Predicate[0]));

                // INTAKE requests are visible to all SOs (not team-scoped) so any SO
                // can add scope items from their team regardless of which team owns the
                // system intake product. Matches INTAKE requests with any item in an
                // actionable state (SUBMITTED or IN_REVIEW).
                var intakeScopingSub = query.subquery(Long.class);
                var intakeItemRoot = intakeScopingSub.from(EstimateRequestItem.class);
                intakeScopingSub.select(intakeItemRoot.get("estimateRequestId"));
                intakeScopingSub.where(
                    cb.equal(intakeItemRoot.get("estimateRequestId"), root.get("id")),
                    cb.equal(root.get("requestType"), "INTAKE"),
                    intakeItemRoot.get("status").in(EstimateStatus.SUBMITTED, EstimateStatus.IN_REVIEW)
                );
                ps.add(cb.or(cb.exists(itemSub), cb.exists(intakeScopingSub)));

                if (search != null && !search.isEmpty()) {
                    ps.add(cb.like(
                        cb.lower(root.get("title")),
                        "%" + search.toLowerCase() + "%"
                    ));
                }

                if (requestTypeFilter != null && !requestTypeFilter.isBlank()) {
                    ps.add(cb.equal(root.get("requestType"), requestTypeFilter));
                }

                return cb.and(ps.toArray(new jakarta.persistence.criteria.Predicate[0]));
            };

        Page<EstimateRequest> page = requestRepository.findAll(spec, pageable);

        List<Long> requestIds = page.stream().map(EstimateRequest::getId).toList();
        Map<Long, List<EstimateRequestItem>> itemsByRequestId = loadItemsForRequests(requestIds);
        Map<Long, String> productNames = batchLoadProductNames(itemsByRequestId);
        Map<Long, String> subNames = batchLoadSubNames(itemsByRequestId);
        Map<Long, String> userNames = batchLoadUserNames(page.getContent(), itemsByRequestId);
        Map<Long, Integer> answeredByItemId = batchLoadAnsweredCounts(itemsByRequestId);
        Map<Long, Integer> totalByItemId = batchLoadTotalQuestionCounts(itemsByRequestId);

        return page.map(req -> {
            List<EstimateRequestItem> items = itemsByRequestId.getOrDefault(req.getId(), List.of());
            return toListItem(req, items, productNames, subNames, userNames, answeredByItemId, totalByItemId);
        });
    }

    // ---- Requester-initiated pricing review (V28) ---------------------------

    /**
     * Requester sends a fully-approved estimate to (or back to) the pricing
     * review queue and optionally supplies context for the Revenue Manager.
     *
     * <p>Guard: all items must be APPROVED and the current pricing review
     * status must not already be PENDING or IN_REVIEW.
     */
    @Transactional
    public EstimateRequestDetail requestPricingReview(
        Long requestId, RequestPricingReviewRequest dto, User actor
    ) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        if (!actor.isAdmin() && !actor.getId().equals(request.getRequesterId())) {
            throw ApiException.notFound("Estimate request " + requestId + " not found.");
        }

        List<EstimateRequestItem> items =
            itemRepository.findByEstimateRequestIdOrderByDisplayOrderAsc(requestId);
        boolean allApproved = !items.isEmpty()
            && items.stream().allMatch(i -> i.getStatus() == EstimateStatus.APPROVED);
        if (!allApproved) {
            throw new ApiException(org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE", "All items must be approved before requesting pricing review.");
        }

        String prs = request.getPricingReviewStatus();
        if ("PENDING".equals(prs) || "IN_REVIEW".equals(prs)) {
            throw new ApiException(org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE", "This request is already in the pricing review queue.");
        }

        String context = dto.context() == null ? null : dto.context().strip();
        if (context != null && context.isEmpty()) context = null;
        request.setRequesterPricingContext(context);
        request.setPricingReviewStatus("PENDING");
        requestRepository.save(request);

        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId,
            ChangeAction.PRICING_REVIEW_REQUESTED, actor,
            "Requester sent '" + request.getTitle() + "' for pricing review."
        );
        return toDetail(request, actor);
    }

    // ---- Pricing review queue (V27) ----------------------------------------

    @Transactional(readOnly = true)
    public Page<EstimateRequestListItem> pricingReviewQueue(Pageable pageable) {
        Page<EstimateRequest> page = requestRepository
            .findByPricingReviewStatusIn(List.of("PENDING", "IN_REVIEW"), pageable);

        List<Long> requestIds = page.stream().map(EstimateRequest::getId).toList();
        Map<Long, List<EstimateRequestItem>> itemsByRequestId = loadItemsForRequests(requestIds);
        Map<Long, String> productNames = batchLoadProductNames(itemsByRequestId);
        Map<Long, String> subNames = batchLoadSubNames(itemsByRequestId);
        Map<Long, String> userNames = batchLoadUserNames(page.getContent(), itemsByRequestId);
        Map<Long, Integer> answeredByItemId = batchLoadAnsweredCounts(itemsByRequestId);
        Map<Long, Integer> totalByItemId = batchLoadTotalQuestionCounts(itemsByRequestId);

        return page.map(req -> {
            List<EstimateRequestItem> items =
                itemsByRequestId.getOrDefault(req.getId(), List.of());
            return toListItem(req, items, productNames, subNames, userNames,
                answeredByItemId, totalByItemId);
        });
    }

    /**
     * Reviewer-side detail load. Visible on any non-Draft request
     * (Drafts stay private to the requester).
     *
     * <p>Phase 9b M4: items are annotated with {@code isReviewable = true}
     * when the current reviewer is on the item's team and the item is
     * SUBMITTED or IN_REVIEW-by-this-reviewer.
     */
    @Transactional(readOnly = true)
    public EstimateRequestDetail getForReview(Long id, User reviewer) {
        EstimateRequest request = requestRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(id);
        String derivedStatus = computeDerivedStatus(items, request);
        if ("DRAFT".equals(derivedStatus)) {
            // Drafts are private to the requester. Don't leak existence.
            throw ApiException.notFound("Estimate request " + id + " not found.");
        }
        Set<Long> accessibleProductIds = reviewer.isAdmin()
            ? null  // admin can act on any item — computed per-item below
            : reviewerAccessibleProductIds(reviewer.getId());
        return toDetailForReview(request, reviewer, accessibleProductIds);
    }

    /** SO claims a specific item for per-item review. */
    @Transactional
    public EstimateRequestDetail startItemReview(Long requestId, Long itemId, User reviewer) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        EstimateRequestItem item = requireItemOnRequest(requestId, itemId);

        // Idempotent: same SO calling start twice on the same item is a no-op
        if (item.getStatus() == EstimateStatus.IN_REVIEW
            && reviewer.getId().equals(item.getReviewerId())) {
            return toDetail(request, reviewer);
        }

        if (item.getStatus() == EstimateStatus.IN_REVIEW) {
            String otherName = userRepository.findById(item.getReviewerId())
                .map(User::fullName).orElse("another reviewer");
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "ALREADY_IN_REVIEW",
                otherName + " is currently reviewing this item."
            );
        }
        if (item.getStatus() != EstimateStatus.SUBMITTED) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Submitted items can enter review."
            );
        }

        requireTeamMembership(reviewer, item);

        item.setStatus(EstimateStatus.IN_REVIEW);
        item.setReviewerId(reviewer.getId());
        itemRepository.save(item);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_REVIEW_STARTED, reviewer,
            "Started review of '" + productName + "' in '" + request.getTitle() + "'"
        );
        return toDetail(request, reviewer);
    }

    /** SO releases an item back to the queue without a decision. Admin can release any claim. */
    @Transactional
    public EstimateRequestDetail releaseItemReview(Long requestId, Long itemId, User actor) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        EstimateRequestItem item = requireItemOnRequest(requestId, itemId);

        if (item.getStatus() != EstimateStatus.IN_REVIEW) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only In Review items can be released."
            );
        }
        if (!actor.isAdmin() && !actor.getId().equals(item.getReviewerId())) {
            throw new ApiException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                "NOT_THE_REVIEWER",
                "Only the current reviewer can release this item."
            );
        }
        item.setStatus(EstimateStatus.SUBMITTED);
        item.setReviewerId(null);
        itemRepository.save(item);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_REVIEW_RELEASED, actor,
            "Released '" + productName + "' back to queue"
        );
        return toDetail(request, actor);
    }

    /**
     * SO approves an item. Complexity, justification, and line overrides are
     * all committed in one atomic action — no separate autosave step.
     */
    @Transactional
    public EstimateRequestDetail approveItem(
        Long requestId, Long itemId, ApproveItemRequest dto, User reviewer
    ) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        EstimateRequestItem item = requireItemInReviewByActor(requestId, itemId, reviewer);

        item.setComplexity(dto.complexity());

        if (dto.justification() != null) {
            String trimmed = dto.justification().trim();
            item.setJustification(trimmed.isEmpty() ? null : trimmed);
        }

        if (dto.lineOverrides() != null && !dto.lineOverrides().isEmpty()) {
            List<EstimateRequestPhaseLine> lines = phaseLineRepository
                .findAllByItemIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(item.getId());
            Map<Long, EstimateRequestPhaseLine> byPhaseId = lines.stream()
                .collect(Collectors.toMap(EstimateRequestPhaseLine::getSdlcPhaseId, l -> l));
            for (LineOverrideInput ov : dto.lineOverrides()) {
                EstimateRequestPhaseLine line = byPhaseId.get(ov.sdlcPhaseId());
                if (line == null) {
                    throw ApiException.badRequest(
                        "Override sdlcPhaseId " + ov.sdlcPhaseId()
                            + " is not part of this item's snapshot.");
                }
                line.setOnshoreOverride(ov.onshoreOverride());
                line.setOffshoreOverride(ov.offshoreOverride());
            }
            phaseLineRepository.saveAll(lines);
        }

        BlendedRate currentRate = blendedRateRepository.findCurrentAsOf(LocalDate.now()).orElse(null);
        item.setApprovedBlendedRateId(currentRate == null ? null : currentRate.getId());

        // Snapshot effective pricing config at approval time
        EffectivePricingDto pricing =
            clientPricingService.getEffectivePricingForCategory(request.getCategoryId());
        item.setApprovedPricingModel(pricing.pricingModel());
        item.setApprovedTmMultiplier(pricing.tmMultiplier());
        item.setApprovedTmTargetMarginPct(pricing.tmTargetMarginPct());
        item.setApprovedMatBillableRate(pricing.matBillableRate());
        item.setApprovedMatDiscountPct(pricing.matDiscountPct());

        item.setStatus(EstimateStatus.APPROVED);
        item.setReviewedAt(OffsetDateTime.now());
        itemRepository.save(item);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();
        String notes = "Approved '" + productName + "' in '" + request.getTitle() + "'"
            + " (complexity=" + dto.complexity()
            + (currentRate != null ? ", blended rate id=" + currentRate.getId() : "") + ")";
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_APPROVED, reviewer, notes
        );

        User requester = userRepository.findById(request.getRequesterId()).orElse(null);
        eventPublisher.publishEvent(new ItemApprovedEvent(
            requestId, request.getTitle(), itemId, productName, requester
        ));

        // If all items are now approved and revenue review is enabled, queue for pricing review.
        List<EstimateRequestItem> allItems =
            itemRepository.findByEstimateRequestIdOrderByDisplayOrderAsc(requestId);
        boolean allApproved = !allItems.isEmpty()
            && allItems.stream().allMatch(i -> i.getStatus() == EstimateStatus.APPROVED);
        if (allApproved && appSettingService.isRevenueReviewEnabled()
                && request.getPricingReviewStatus() == null) {
            request.setPricingReviewStatus("PENDING");
            requestRepository.save(request);
        }

        return toDetail(request, reviewer);
    }

    /** SO rejects an item with a required rejection reason. Complexity is cleared for re-review. */
    @Transactional
    public EstimateRequestDetail rejectItem(
        Long requestId, Long itemId, RejectItemRequest dto, User reviewer
    ) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        EstimateRequestItem item = requireItemInReviewByActor(requestId, itemId, reviewer);

        String reason = dto.rejectionReason() == null ? "" : dto.rejectionReason().trim();
        if (reason.isEmpty()) {
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "MISSING_REJECTION_REASON",
                "Rejection requires a reason."
            );
        }

        item.setRejectionReason(reason);
        item.setStatus(EstimateStatus.REJECTED);
        item.setReviewedAt(OffsetDateTime.now());
        item.setComplexity(null);
        itemRepository.save(item);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();
        String preview = reason.length() > 100 ? reason.substring(0, 100) + "…" : reason;
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_REJECTED, reviewer,
            "Rejected '" + productName + "' in '" + request.getTitle() + "'. Reason: " + preview
        );

        User requester = userRepository.findById(request.getRequesterId()).orElse(null);
        eventPublisher.publishEvent(new ItemRejectedEvent(
            requestId, request.getTitle(), itemId, productName, requester, reason
        ));

        return toDetail(request, reviewer);
    }

    /**
     * Combined revise + resubmit for a REJECTED item. Handles answer updates and
     * optional product swap in a single transaction. Increments {@code revisionCount},
     * clears review state, deletes the old phase-line snapshot, and re-snapshots
     * from the current active template.
     *
     * <p>Product swap tracking: {@code originalProductId} is set ONLY on the first swap;
     * subsequent swaps leave it unchanged so the original trail is preserved.
     */
    @Transactional
    public EstimateRequestDetail reviseAndResubmitItem(
        Long requestId, Long itemId, ReviseAndResubmitRequest dto, User requester
    ) {
        EstimateRequest request = requireOwnedRequest(requestId, requester);
        EstimateRequestItem item = requireItemOnRequest(requestId, itemId);

        boolean isNeedsClarification = item.getStatus() == EstimateStatus.NEEDS_CLARIFICATION;
        boolean isRecalled = item.getStatus() == EstimateStatus.RECALLED;
        if (item.getStatus() != EstimateStatus.REJECTED
                && !isNeedsClarification && !isRecalled) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Rejected, Clarification-needed, or Recalled items can be revised and resubmitted."
            );
        }

        // Preserve reviewer for clarification responses so the item goes back to IN_REVIEW.
        Long preservedReviewerId = isNeedsClarification ? item.getReviewerId() : null;

        // Clear review state
        // Save clarification response before clearing review state
        if (isNeedsClarification && dto.clarificationResponse() != null) {
            String response = dto.clarificationResponse().trim();
            item.setClarificationResponse(response.isEmpty() ? null : response);
        }

        item.setReviewerId(null);
        item.setReviewedAt(null);
        item.setComplexity(null);
        item.setJustification(null);
        item.setApprovedBlendedRateId(null);
        item.setApprovedPricingModel(null);
        item.setApprovedTmMultiplier(null);
        item.setApprovedTmTargetMarginPct(null);
        item.setApprovedMatBillableRate(null);
        item.setApprovedMatDiscountPct(null);
        item.setRejectionReason(null);
        // clarificationNote intentionally kept when returning from NEEDS_CLARIFICATION
        // so the reviewer can see their original question alongside the requester's response.
        // It is overwritten when the SO raises a new clarification request.
        if (!isNeedsClarification) {
            item.setClarificationNote(null);
        }

        // Optional product swap
        if (dto.productId() != null && !dto.productId().equals(item.getProductId())) {
            Product newProduct = productRepository.findById(dto.productId())
                .orElseThrow(() -> ApiException.badRequest(
                    "Product " + dto.productId() + " not found."));
            if (!newProduct.isActive()) {
                throw ApiException.badRequest(
                    "Product '" + newProduct.getName() + "' is not active.");
            }

            Long newSubFeatureId = null;
            if (newProduct.getMode() == ProductMode.CONTAINER) {
                if (dto.subFeatureId() == null) {
                    throw ApiException.badRequest(
                        "This is a container product — a sub-feature must be selected.");
                }
                SubFeature sub = subFeatureRepository.findById(dto.subFeatureId())
                    .orElseThrow(() -> ApiException.badRequest(
                        "Sub-feature " + dto.subFeatureId() + " not found."));
                if (!sub.getProductId().equals(newProduct.getId())) {
                    throw ApiException.badRequest(
                        "Sub-feature does not belong to the chosen product.");
                }
                if (!sub.isActive()) {
                    throw ApiException.badRequest("Sub-feature is not active.");
                }
                newSubFeatureId = sub.getId();
            } else {
                if (dto.subFeatureId() != null) {
                    throw ApiException.badRequest(
                        "Atomic products do not have sub-features — leave subFeatureId null.");
                }
            }

            // Track original product on first swap only
            if (item.getOriginalProductId() == null) {
                item.setOriginalProductId(item.getProductId());
            }
            item.setProductId(dto.productId());
            item.setSubFeatureId(newSubFeatureId);
        }

        // Only increment revision count for REJECTED flows — clarification and recall
        // are not substantive re-estimates.
        if (!isNeedsClarification && !isRecalled) {
            item.setRevisionCount(item.getRevisionCount() + 1);
        }

        // Update answers if provided (replace-all)
        if (dto.answers() != null) {
            performSaveAnswers(item, dto.answers());
        }

        // Delete old phase-line snapshot so submitItem re-snapshots from current template
        phaseLineRepository.deleteAllByItemId(item.getId());
        phaseLineRepository.flush();

        // Re-validate and re-snapshot (sets status → SUBMITTED, stamps submittedAt)
        submitItem(item);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();

        if (isNeedsClarification) {
            // Route directly back to IN_REVIEW for the same SO.
            item.setStatus(EstimateStatus.IN_REVIEW);
            item.setReviewerId(preservedReviewerId);
            itemRepository.save(item);
            auditService.recordAction(
                EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_CLARIFICATION_ANSWERED,
                requester,
                "Responded to clarification for '" + productName + "' in '" + request.getTitle() + "'"
            );
            User reviewer = preservedReviewerId != null
                ? userRepository.findById(preservedReviewerId).orElse(null) : null;
            eventPublisher.publishEvent(new ClarificationRespondedEvent(
                requestId, request.getTitle(), itemId, productName, reviewer
            ));
        } else {
            itemRepository.save(item);
            if (!isRecalled) {
                auditService.recordAction(
                    EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_REVISED, requester,
                    "Revised '" + productName + "' in '" + request.getTitle() + "'"
                );
            }
            auditService.recordAction(
                EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_RESUBMITTED, requester,
                "Resubmitted '" + productName + "' in '" + request.getTitle() + "'"
            );
        }
        return toDetail(request, requester);
    }

    /**
     * Requester drops a REJECTED item from their request. Cannot drop the last item —
     * use {@code discard} to delete the entire request instead.
     */
    @Transactional
    public EstimateRequestDetail dropItem(Long requestId, Long itemId, User requester) {
        EstimateRequest request = requireOwnedRequest(requestId, requester);
        EstimateRequestItem item = requireItemOnRequest(requestId, itemId);

        if (item.getStatus() != EstimateStatus.REJECTED
                && item.getStatus() != EstimateStatus.RECALLED) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Rejected or Recalled items can be dropped."
            );
        }

        List<EstimateRequestItem> allItems = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(requestId);
        if (allItems.size() <= 1) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "CANNOT_DROP_LAST_ITEM",
                "Cannot drop the last item. Use discard to delete the entire request."
            );
        }

        // Delete child rows before the item to satisfy FK constraints
        phaseLineRepository.deleteAllByItemId(itemId);
        answerRepository.deleteAllByItemId(itemId);
        itemRepository.delete(item);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_DROPPED, requester,
            "Dropped '" + productName + "' from '" + request.getTitle() + "'"
        );
        return toDetail(request, requester);
    }

    /**
     * Admin-only safety valve: send a single APPROVED item back to SUBMITTED
     * so a different SO can re-review it. Clears all review state and line overrides.
     */
    @Transactional
    public EstimateRequestDetail sendBackItem(
        Long requestId, Long itemId, com.acme.estimator.estimates.dto.SendBackRequest req,
        User actor
    ) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        EstimateRequestItem item = requireItemOnRequest(requestId, itemId);

        if (item.getStatus() != EstimateStatus.APPROVED) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Approved items can be sent back."
            );
        }

        String reason = req.reason() == null ? "" : req.reason().trim();
        if (reason.isEmpty()) {
            throw ApiException.badRequest("Send-back requires a reason.");
        }

        item.setReviewerId(null);
        item.setReviewedAt(null);
        item.setComplexity(null);
        item.setJustification(null);
        item.setApprovedBlendedRateId(null);
        item.setApprovedPricingModel(null);
        item.setApprovedTmMultiplier(null);
        item.setApprovedTmTargetMarginPct(null);
        item.setApprovedMatBillableRate(null);
        item.setApprovedMatDiscountPct(null);
        item.setRmPricingModel(null);
        item.setRmTmMultiplier(null);
        item.setRmTmTargetMarginPct(null);
        item.setRmMatBillableRate(null);
        item.setRmMatDiscountPct(null);
        item.setStatus(EstimateStatus.SUBMITTED);
        itemRepository.save(item);

        // Clear the pricing review state since the request is no longer fully approved.
        if (request.getPricingReviewStatus() != null) {
            request.setPricingReviewStatus(null);
            request.setRmReviewerId(null);
            request.setRmDiscountPct(null);
            request.setRmNotes(null);
            request.setRmReviewedAt(null);
            requestRepository.save(request);
        }

        List<EstimateRequestPhaseLine> lines = phaseLineRepository
            .findAllByItemIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(item.getId());
        for (var line : lines) {
            line.setOnshoreOverride(null);
            line.setOffshoreOverride(null);
        }
        phaseLineRepository.saveAll(lines);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_SENT_BACK, actor,
            "Sent back '" + productName + "' in '" + request.getTitle() + "'. Reason: " + reason
        );

        User requester = userRepository.findById(request.getRequesterId()).orElse(null);
        eventPublisher.publishEvent(new ItemSentBackEvent(
            requestId, request.getTitle(), itemId, productName, requester
        ));

        return toDetail(request, actor);
    }

    /**
     * SO requests clarification from the requester on an IN_REVIEW item.
     * The item transitions to NEEDS_CLARIFICATION; reviewer_id stays set so the
     * item routes back to the same SO when the requester resubmits.
     */
    @Transactional
    public EstimateRequestDetail requestClarification(
        Long requestId, Long itemId,
        com.acme.estimator.estimates.dto.RequestClarificationRequest req,
        User actor
    ) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        EstimateRequestItem item = requireItemInReviewByActor(requestId, itemId, actor);

        String note = req.clarificationNote() == null ? "" : req.clarificationNote().trim();
        if (note.isEmpty()) {
            throw ApiException.badRequest("A clarification note is required.");
        }

        item.setStatus(EstimateStatus.NEEDS_CLARIFICATION);
        item.setClarificationNote(note);
        item.setClarificationResponse(null); // clear any previous response
        // reviewer_id intentionally kept — item routes back to this SO on resubmit
        itemRepository.save(item);

        Product product = productRepository.findById(item.getProductId()).orElse(null);
        String productName = product == null ? "item" : product.getName();
        String preview = note.length() > 100 ? note.substring(0, 100) + "…" : note;
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_CLARIFICATION_REQUESTED,
            actor,
            "Requested clarification for '" + productName + "' in '" + request.getTitle()
                + "'. Note: " + preview
        );

        User requester = userRepository.findById(request.getRequesterId()).orElse(null);
        eventPublisher.publishEvent(new ItemNeedsClarificationEvent(
            requestId, request.getTitle(), itemId, productName, requester, note
        ));

        return toDetail(request, actor);
    }

    /**
     * Requester recalls an item from SUBMITTED or IN_REVIEW back to RECALLED state.
     * If the item was IN_REVIEW, the reviewer's claim is released and recorded in the audit log.
     */
    @Transactional
    public EstimateRequestDetail recallItem(Long requestId, Long itemId, User requester) {
        EstimateRequest request = requireOwnedRequest(requestId, requester);
        EstimateRequestItem item = requireItemOnRequest(requestId, itemId);

        if (item.getStatus() != EstimateStatus.SUBMITTED
                && item.getStatus() != EstimateStatus.IN_REVIEW) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Submitted or In Review items can be recalled."
            );
        }

        boolean wasInReview = item.getStatus() == EstimateStatus.IN_REVIEW;
        User priorReviewer = wasInReview && item.getReviewerId() != null
            ? userRepository.findById(item.getReviewerId()).orElse(null) : null;

        String auditNote = "Recalled '" + productName(item) + "' from '"
            + request.getTitle() + "'";
        if (wasInReview && priorReviewer != null) {
            auditNote += " (was in review by " + priorReviewer.fullName() + ")";
        }

        item.setStatus(EstimateStatus.RECALLED);
        item.setReviewerId(null);
        item.setSubmittedAt(null);
        itemRepository.save(item);

        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_RECALLED, requester, auditNote
        );

        if (wasInReview) {
            eventPublisher.publishEvent(new ItemRecalledEvent(
                requestId, request.getTitle(), itemId, productName(item), priorReviewer
            ));
        }

        return toDetail(request, requester);
    }

    private String productName(EstimateRequestItem item) {
        return productRepository.findById(item.getProductId())
            .map(Product::getName).orElse("item");
    }

    private List<User> sosByProduct(EstimateRequestItem item) {
        Product product = productRepository.findById(item.getProductId()).orElse(null);
        if (product == null || product.getTeam() == null) return List.of();
        return userRepository.findByTeamId(product.getTeam().getId()).stream()
            .filter(u -> u.isActive() && u.getRoles().stream()
                .anyMatch(r -> "SOLUTION_OWNER".equals(r.getName())))
            .toList();
    }

    @Transactional
    public void deleteRequest(Long requestId, User actor) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        String title = request.getTitle();
        requestRepository.deleteById(requestId);
        auditService.recordDeleted(EstimateRequest.ENTITY_TYPE, requestId, actor, "\"" + title + "\"");
    }

    // ---- derived status ---------------------------------------------------

    private String computeDerivedStatus(List<EstimateRequestItem> items, EstimateRequest request) {
        return getDerivedStatus(items, request);
    }

    /**
     * Compute the derived status of a request from its items.
     *
     * <p>Rules (in priority order):
     * <ol>
     *   <li>No items → DRAFT
     *   <li>All APPROVED + pricingReviewStatus PENDING or IN_REVIEW → PRICING_REVIEW
     *   <li>All APPROVED → APPROVED
     *   <li>Any NEEDS_CLARIFICATION → NEEDS_CLARIFICATION (SO is waiting on requester)
     *   <li>Any REJECTED → NEEDS_REVISION
     *   <li>Any RECALLED → RECALLED (requester pulled back at least one item)
     *   <li>Any APPROVED (but not all, none of the above) → PARTIALLY_APPROVED
     *   <li>Any IN_REVIEW → IN_REVIEW
     *   <li>All SUBMITTED → SUBMITTED
     *   <li>Otherwise (mixed DRAFT + other, or all DRAFT) → DRAFT
     * </ol>
     */
    public static String getDerivedStatus(List<EstimateRequestItem> items) {
        return getDerivedStatus(items, null);
    }

    public static String getDerivedStatus(List<EstimateRequestItem> items, EstimateRequest request) {
        if (items.isEmpty()) return "DRAFT";
        boolean allApproved = items.stream().allMatch(i -> i.getStatus() == EstimateStatus.APPROVED);
        if (allApproved) {
            if (request != null) {
                String prs = request.getPricingReviewStatus();
                if ("PENDING".equals(prs) || "IN_REVIEW".equals(prs)) return "PRICING_REVIEW";
            }
            return "APPROVED";
        }
        boolean anyNeedsClarification = items.stream()
            .anyMatch(i -> i.getStatus() == EstimateStatus.NEEDS_CLARIFICATION);
        if (anyNeedsClarification) return "NEEDS_CLARIFICATION";
        boolean anyRejected = items.stream().anyMatch(i -> i.getStatus() == EstimateStatus.REJECTED);
        if (anyRejected) return "NEEDS_REVISION";
        boolean anyRecalled = items.stream().anyMatch(i -> i.getStatus() == EstimateStatus.RECALLED);
        if (anyRecalled) return "RECALLED";
        boolean anyApproved = items.stream().anyMatch(i -> i.getStatus() == EstimateStatus.APPROVED);
        if (anyApproved) return "PARTIALLY_APPROVED";
        boolean anyInReview = items.stream().anyMatch(i -> i.getStatus() == EstimateStatus.IN_REVIEW);
        if (anyInReview) return "IN_REVIEW";
        boolean allSubmitted = items.stream().allMatch(i -> i.getStatus() == EstimateStatus.SUBMITTED);
        if (allSubmitted) return "SUBMITTED";
        return "DRAFT";
    }

    // ---- private helpers --------------------------------------------------

    /** Loads an item and verifies it belongs to the given request. Returns 404 on mismatch. */
    private EstimateRequestItem requireItemOnRequest(Long requestId, Long itemId) {
        EstimateRequestItem item = itemRepository.findById(itemId)
            .orElseThrow(() -> ApiException.notFound("Item " + itemId + " not found."));
        if (!requestId.equals(item.getEstimateRequestId())) {
            throw ApiException.notFound(
                "Item " + itemId + " does not belong to request " + requestId + ".");
        }
        return item;
    }

    /**
     * Guard: item must be IN_REVIEW and claimed by actor.
     * Admin override: admin can act on any IN_REVIEW item regardless of reviewer_id.
     */
    private EstimateRequestItem requireItemInReviewByActor(
        Long requestId, Long itemId, User actor
    ) {
        EstimateRequestItem item = requireItemOnRequest(requestId, itemId);
        if (item.getStatus() != EstimateStatus.IN_REVIEW) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Item must be In Review for this action."
            );
        }
        if (!actor.isAdmin() && !actor.getId().equals(item.getReviewerId())) {
            throw new ApiException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                "NOT_THE_REVIEWER",
                "Only the current reviewer can perform this action."
            );
        }
        return item;
    }

    /**
     * Hard authorization check: reviewer must be on the product's team.
     * Admin bypasses the check. Products with no assigned team allow any SO.
     */
    private void requireTeamMembership(User reviewer, EstimateRequestItem item) {
        if (reviewer.isAdmin()) return;
        Product product = productRepository.findById(item.getProductId()).orElse(null);
        requireTeamMembership(reviewer, product);
    }

    private void requireTeamMembership(User reviewer, Product product) {
        if (reviewer.isAdmin()) return;
        if (product == null || product.getTeam() == null) return; // unassigned — permissive
        Long teamId = product.getTeam().getId();
        Set<Long> reviewerTeamIds = userRepository.findTeamIdsByUserId(reviewer.getId());
        if (!reviewerTeamIds.contains(teamId)) {
            throw new ApiException(
                org.springframework.http.HttpStatus.FORBIDDEN,
                "NOT_ON_TEAM",
                "You can only review items from products assigned to your team."
            );
        }
    }

    /**
     * SO adds a catalog scope item to an INTAKE request. The item is created
     * in IN_REVIEW state with the calling SO as reviewer and the active template
     * phase lines snapshotted immediately.
     *
     * <p>V30: new capability enabling the free-for-all scoping model where
     * multiple SOs each contribute items from their respective teams.
     */
    @Transactional
    public EstimateRequestDetail addScopeItem(Long requestId, AddScopeItemRequest dto, User actor) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));

        if (!"INTAKE".equals(request.getRequestType())) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_REQUEST_TYPE",
                "Scope items can only be added to INTAKE requests."
            );
        }

        List<EstimateRequestItem> existingItems =
            itemRepository.findByEstimateRequestIdOrderByDisplayOrderAsc(requestId);
        String derivedStatus = computeDerivedStatus(existingItems, request);
        if ("APPROVED".equals(derivedStatus) || "PRICING_REVIEW".equals(derivedStatus)) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Cannot add scope items to an already-approved request."
            );
        }

        Product product = productRepository.findById(dto.productId())
            .orElseThrow(() -> ApiException.badRequest("Product " + dto.productId() + " not found."));
        if (!product.isActive()) {
            throw ApiException.badRequest("Product '" + product.getName() + "' is not active.");
        }

        requireTeamMembership(actor, product);

        Long resolvedSubFeatureId = null;
        if (product.getMode() == ProductMode.CONTAINER) {
            if (dto.subFeatureId() == null) {
                throw ApiException.badRequest(
                    "This is a container product — a sub-feature must be selected.");
            }
            SubFeature sub = subFeatureRepository.findById(dto.subFeatureId())
                .orElseThrow(() -> ApiException.badRequest(
                    "Sub-feature " + dto.subFeatureId() + " not found."));
            if (!sub.getProductId().equals(product.getId())) {
                throw ApiException.badRequest("Sub-feature does not belong to the chosen product.");
            }
            if (!sub.isActive()) {
                throw ApiException.badRequest("Sub-feature is not active.");
            }
            resolvedSubFeatureId = sub.getId();
        } else {
            if (dto.subFeatureId() != null) {
                throw ApiException.badRequest(
                    "Atomic products do not have sub-features — leave subFeatureId null.");
            }
        }

        // Guard: same product/sub-feature not already in this request
        final Long finalSubId = resolvedSubFeatureId;
        boolean duplicate = existingItems.stream()
            .anyMatch(i -> dto.productId().equals(i.getProductId())
                && java.util.Objects.equals(finalSubId, i.getSubFeatureId()));
        if (duplicate) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "DUPLICATE_PRODUCT",
                "This product/sub-feature is already part of this request."
            );
        }

        Optional<EstimateTemplate> activeTemplate = (resolvedSubFeatureId != null)
            ? templateRepository.findActiveBySubFeatureId(resolvedSubFeatureId)
            : templateRepository.findActiveByProductId(dto.productId());
        if (activeTemplate.isEmpty()) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "NO_ACTIVE_TEMPLATE",
                "No active estimate template exists for this product. Publish a template before scoping."
            );
        }

        int displayOrder = existingItems.stream()
            .mapToInt(EstimateRequestItem::getDisplayOrder)
            .max().orElse(-1) + 1;

        EstimateRequestItem item = new EstimateRequestItem();
        item.setEstimateRequestId(requestId);
        item.setProductId(dto.productId());
        item.setSubFeatureId(resolvedSubFeatureId);
        item.setItemType("SCOPE");
        item.setTemplateId(activeTemplate.get().getId());
        item.setStatus(EstimateStatus.IN_REVIEW);
        item.setReviewerId(actor.getId());
        item.setSubmittedAt(OffsetDateTime.now());
        item.setDisplayOrder(displayOrder);
        EstimateRequestItem savedItem = itemRepository.save(item);

        snapshotPhaseLines(savedItem, activeTemplate.get());

        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId, ChangeAction.ITEM_REVIEW_STARTED, actor,
            "Scoped '" + product.getName() + "' into '" + request.getTitle() + "'"
        );

        return toDetail(request, actor);
    }


    private EstimateRequest requireOwnedRequest(Long id, User requester) {
        return requestRepository.findByIdAndRequesterId(id, requester.getId())
            .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
    }

    private EstimateRequest loadVisibleRequest(Long id, User actor) {
        if (actor.isAdmin()) {
            return requestRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Estimate request " + id + " not found."));
        }
        return requireOwnedRequest(id, actor);
    }

    private void requireAllDraft(List<EstimateRequestItem> items) {
        boolean anyNonDraft = items.stream()
            .anyMatch(i -> i.getStatus() != EstimateStatus.DRAFT);
        if (anyNonDraft) {
            throw new ApiException(
                org.springframework.http.HttpStatus.CONFLICT,
                "INVALID_STATE",
                "Only Draft requests can be modified."
            );
        }
    }

    /**
     * Validate and build a new EstimateRequestItem from a CreateItemRequest.
     */
    private EstimateRequestItem buildAndValidateItem(
        CreateItemRequest req, Long requestId, int displayOrder
    ) {
        Product product = productRepository.findById(req.productId())
            .orElseThrow(() -> ApiException.badRequest("Product " + req.productId() + " not found."));
        if (!product.isActive()) {
            throw ApiException.badRequest("Product '" + product.getName() + "' is not active.");
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
            if (req.subFeatureId() != null) {
                throw ApiException.badRequest(
                    "Atomic products do not have sub-features — leave subFeatureId null."
                );
            }
        }

        EstimateRequestItem item = new EstimateRequestItem();
        item.setEstimateRequestId(requestId);
        item.setProductId(product.getId());
        item.setSubFeatureId(subFeatureId);
        item.setStatus(EstimateStatus.DRAFT);
        item.setDisplayOrder(displayOrder);
        return item;
    }

    /**
     * Validate that no two items target the same (productId, subFeatureId) combination.
     */
    private void validateNoDuplicateItems(List<CreateItemRequest> items) {
        Set<String> seen = new HashSet<>();
        for (CreateItemRequest item : items) {
            String key = item.productId() + ":" + item.subFeatureId();
            if (!seen.add(key)) {
                throw ApiException.badRequest(
                    "Duplicate product/sub-feature combination in items list. " +
                    "Each product (or sub-feature) may only appear once per request."
                );
            }
        }
    }

    /**
     * Perform the actual answer-save logic for an item (replace-all pattern).
     */
    private void performSaveAnswers(EstimateRequestItem item, List<AnswerInput> inputs) {
        List<CriticalQuestion> validQuestions = loadQuestionsForItem(item);
        Map<Long, CriticalQuestion> validById = validQuestions.stream()
            .collect(Collectors.toMap(CriticalQuestion::getId, q -> q));

        Set<Long> seen = new HashSet<>();
        for (AnswerInput in : inputs) {
            if (!seen.add(in.questionId())) {
                throw ApiException.badRequest(
                    "Duplicate questionId in answers: " + in.questionId()
                );
            }
            if (!validById.containsKey(in.questionId())) {
                throw ApiException.badRequest(
                    "Question " + in.questionId() + " does not belong to this item's parent."
                );
            }
        }

        answerRepository.deleteAllByItemId(item.getId());
        answerRepository.flush();

        List<EstimateRequestQuestionAnswer> rows = new ArrayList<>(inputs.size());
        for (AnswerInput in : inputs) {
            CriticalQuestion q = validById.get(in.questionId());
            String answer = in.answerText() == null ? "" : in.answerText();
            if (answer.isBlank()) continue;
            EstimateRequestQuestionAnswer row = new EstimateRequestQuestionAnswer();
            row.setItemId(item.getId());
            row.setCriticalQuestionId(q.getId());
            row.setQuestionTextSnapshot(q.getQuestionText());
            row.setAnswerText(answer);
            rows.add(row);
        }
        answerRepository.saveAll(rows);
    }

    /**
     * Save initial answers for an item at creation time (no flush needed since
     * the item was just saved).
     */
    private void saveAnswersForItem(EstimateRequestItem item, List<AnswerInput> inputs) {
        List<CriticalQuestion> validQuestions = loadQuestionsForItem(item);
        Map<Long, CriticalQuestion> validById = validQuestions.stream()
            .collect(Collectors.toMap(CriticalQuestion::getId, q -> q));

        List<EstimateRequestQuestionAnswer> rows = new ArrayList<>();
        for (AnswerInput in : inputs) {
            CriticalQuestion q = validById.get(in.questionId());
            if (q == null) continue; // skip invalid question IDs at creation
            String answer = in.answerText() == null ? "" : in.answerText();
            if (answer.isBlank()) continue;
            EstimateRequestQuestionAnswer row = new EstimateRequestQuestionAnswer();
            row.setItemId(item.getId());
            row.setCriticalQuestionId(q.getId());
            row.setQuestionTextSnapshot(q.getQuestionText());
            row.setAnswerText(answer);
            rows.add(row);
        }
        answerRepository.saveAll(rows);
    }

    /**
     * Submit a single item: validate, snapshot template lines, flip status.
     */
    private void submitItem(EstimateRequestItem item) {
        // Re-validate the parent is still active
        Product product = productRepository.findById(item.getProductId())
            .orElseThrow(() -> ApiException.badRequest("Product no longer exists."));
        if (!product.isActive()) {
            throw ApiException.badRequest("Product '" + product.getName()
                + "' is no longer active — submission blocked.");
        }
        if (item.getSubFeatureId() != null) {
            SubFeature sub = subFeatureRepository.findById(item.getSubFeatureId())
                .orElseThrow(() -> ApiException.badRequest("Sub-feature no longer exists."));
            if (!sub.isActive()) {
                throw ApiException.badRequest(
                    "Sub-feature '" + sub.getName() + "' is no longer active — submission blocked."
                );
            }
        }

        // Required-question coverage
        List<CriticalQuestion> liveQuestions = loadQuestionsForItem(item);
        Map<Long, EstimateRequestQuestionAnswer> persistedAnswers =
            answerRepository.findAllByItemId(item.getId()).stream()
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

        // Document-required coverage
        Map<Long, List<AttachmentMeta>> uploadedByQuestion =
            attachmentRepository.findMetaByItemId(item.getId()).stream()
                .collect(Collectors.groupingBy(AttachmentMeta::questionId));
        Map<Long, String> missingDocsByQuestionId = new HashMap<>();
        for (CriticalQuestion q : liveQuestions) {
            if (!q.isDocumentUploadRequired()) continue;
            if (uploadedByQuestion.getOrDefault(q.getId(), List.of()).isEmpty()) {
                missingDocsByQuestionId.put(q.getId(), q.getQuestionText());
            }
        }
        if (!missingDocsByQuestionId.isEmpty()) {
            Map<String, String> structured = new HashMap<>();
            missingDocsByQuestionId.forEach(
                (qid, qtext) -> structured.put("document:" + qid, "Required document upload is missing.")
            );
            String first = missingDocsByQuestionId.values().iterator().next();
            throw new ApiException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "MISSING_REQUIRED_DOCUMENTS",
                "Required document uploads are missing: \"" + first + "\".",
                structured
            );
        }

        // Active template lookup
        Optional<EstimateTemplate> activeTemplate = (item.getSubFeatureId() != null)
            ? templateRepository.findActiveBySubFeatureId(item.getSubFeatureId())
            : templateRepository.findActiveByProductId(item.getProductId());
        if (activeTemplate.isEmpty()) {
            String parentLabel;
            if (item.getSubFeatureId() != null) {
                parentLabel = "sub-feature '"
                    + subFeatureRepository.findById(item.getSubFeatureId())
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

        // Snapshot the question text into the answer rows
        Map<Long, String> liveQuestionTextById = liveQuestions.stream()
            .collect(Collectors.toMap(CriticalQuestion::getId, CriticalQuestion::getQuestionText));
        List<EstimateRequestQuestionAnswer> existingAnswerRows =
            answerRepository.findAllByItemId(item.getId());
        for (EstimateRequestQuestionAnswer row : existingAnswerRows) {
            String currentText = liveQuestionTextById.get(row.getCriticalQuestionId());
            if (currentText != null && !currentText.equals(row.getQuestionTextSnapshot())) {
                row.setQuestionTextSnapshot(currentText);
            }
        }
        answerRepository.saveAll(existingAnswerRows);

        snapshotPhaseLines(item, template);

        item.setTemplateId(template.getId());
        item.setStatus(EstimateStatus.SUBMITTED);
        item.setSubmittedAt(OffsetDateTime.now());
    }

    /** Snapshots template phase lines into {@code estimate_request_phase_lines} for the given item. */
    private void snapshotPhaseLines(EstimateRequestItem item, EstimateTemplate template) {
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
            line.setItemId(item.getId());
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
    }

    private List<CriticalQuestion> loadQuestionsForItem(EstimateRequestItem item) {
        if (item.getSubFeatureId() != null) {
            return questionRepository
                .findBySubFeatureIdOrderByDisplayOrder(item.getSubFeatureId())
                .stream().filter(CriticalQuestion::isActive).toList();
        }
        return questionRepository
            .findByProductIdOrderByDisplayOrder(item.getProductId())
            .stream().filter(CriticalQuestion::isActive).toList();
    }

    // ---- toDetail / toListItem --------------------------------------------

    EstimateRequestDetail toDetail(EstimateRequest request, User actor) {
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(request.getId());

        Long categoryId = request.getCategoryId();
        List<EstimateRequestItemDto> itemDtos = items.stream()
            .map(item -> toItemDto(item, actor, false, categoryId))
            .toList();

        String derivedStatus = computeDerivedStatus(items, request);
        ClassificationView cv = loadClassification(request);

        return new EstimateRequestDetail(
            request.getId(),
            request.getTitle(),
            request.getDescription(),
            request.getGoLiveDate(),
            request.getRequesterId(),
            derivedStatus,
            request.getCreatedAt(),
            request.getUpdatedAt(),
            itemDtos,
            cv.categoryId(),
            cv.categoryName(),
            cv.programTypeIds(),
            cv.programTypeNames(),
            cv.clientId(),
            cv.clientName(),
            cv.programId(),
            cv.programName(),
            request.getPricingReviewStatus(),
            request.getRmReviewerId(),
            request.getRmDiscountPct(),
            request.getRmNotes(),
            request.getRmReviewedAt(),
            request.getRequesterPricingContext(),
            request.getRequestType()
        );
    }

    /** Loads category, program-type, client, and program display data for a single request. */
    private ClassificationView loadClassification(EstimateRequest request) {
        String categoryName = categoryRepository.findById(request.getCategoryId())
            .map(Category::getName).orElse(null);
        List<EstimateRequestProgramType> erpts =
            requestProgramTypeRepository.findByRequestId(request.getId());
        List<Long> ptIds = erpts.stream()
            .map(EstimateRequestProgramType::getProgramTypeId).toList();
        List<String> ptNames = ptIds.stream()
            .map(id -> programTypeRepository.findById(id)
                .map(ProgramType::getName).orElse(null))
            .filter(n -> n != null)
            .toList();
        String clientName = request.getClientId() != null
            ? clientRepository.findById(request.getClientId()).map(Client::getName).orElse(null)
            : null;
        String programName = request.getProgramId() != null
            ? programRepository.findById(request.getProgramId()).map(Program::getName).orElse(null)
            : null;
        return new ClassificationView(
            request.getCategoryId(), categoryName, ptIds, ptNames,
            request.getClientId(), clientName, request.getProgramId(), programName
        );
    }

    private record ClassificationView(
        Long categoryId, String categoryName,
        List<Long> programTypeIds, List<String> programTypeNames,
        Long clientId, String clientName,
        Long programId, String programName
    ) {}

    /**
     * Reviewer-facing detail: same as {@link #toDetail} but annotates each item
     * with {@code isReviewable} based on the reviewer's team membership and item status.
     *
     * @param accessibleProductIds product IDs on the reviewer's teams + no-team products;
     *                             {@code null} means admin — all items are reviewable
     */
    private EstimateRequestDetail toDetailForReview(
        EstimateRequest request, User reviewer, Set<Long> accessibleProductIds
    ) {
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(request.getId());

        Long categoryId = request.getCategoryId();
        List<EstimateRequestItemDto> itemDtos = items.stream()
            .map(item -> {
                boolean reviewable = computeIsReviewable(item, reviewer, accessibleProductIds);
                return toItemDto(item, reviewer, reviewable, categoryId);
            })
            .toList();

        String derivedStatus = computeDerivedStatus(items, request);
        ClassificationView cv = loadClassification(request);

        return new EstimateRequestDetail(
            request.getId(),
            request.getTitle(),
            request.getDescription(),
            request.getGoLiveDate(),
            request.getRequesterId(),
            derivedStatus,
            request.getCreatedAt(),
            request.getUpdatedAt(),
            itemDtos,
            cv.categoryId(),
            cv.categoryName(),
            cv.programTypeIds(),
            cv.programTypeNames(),
            cv.clientId(),
            cv.clientName(),
            cv.programId(),
            cv.programName(),
            request.getPricingReviewStatus(),
            request.getRmReviewerId(),
            request.getRmDiscountPct(),
            request.getRmNotes(),
            request.getRmReviewedAt(),
            request.getRequesterPricingContext(),
            request.getRequestType()
        );
    }

    /**
     * An item is reviewable by this actor when:
     * <ul>
     *   <li>item is SUBMITTED and the actor is on the item's product's team
     *       (or the product has no team), OR
     *   <li>item is IN_REVIEW and claimed by this actor (or actor is Admin).
     * </ul>
     * Admin always passes the team check; the product-set is null for admins.
     */
    private boolean computeIsReviewable(
        EstimateRequestItem item, User reviewer, Set<Long> accessibleProductIds
    ) {
        boolean productAccessible = reviewer.isAdmin()
            || (accessibleProductIds != null && accessibleProductIds.contains(item.getProductId()));

        if (item.getStatus() == EstimateStatus.SUBMITTED) {
            return productAccessible;
        }
        if (item.getStatus() == EstimateStatus.IN_REVIEW) {
            return reviewer.isAdmin() || reviewer.getId().equals(item.getReviewerId());
        }
        return false;
    }

    /**
     * Product IDs accessible for review to the given SO:
     * products on their teams plus products with no team (permissive).
     */
    private Set<Long> reviewerAccessibleProductIds(Long reviewerId) {
        Set<Long> teamIds = userRepository.findTeamIdsByUserId(reviewerId);
        Set<Long> teamProducts = teamIds.isEmpty()
            ? Set.of()
            : productRepository.findIdsByTeamIdIn(teamIds);
        Set<Long> noTeamProducts = productRepository.findIdsWithNullTeam();
        return Stream.concat(teamProducts.stream(), noTeamProducts.stream())
            .collect(Collectors.toSet());
    }

    private EstimateRequestItemDto toItemDto(
        EstimateRequestItem item, User actor, boolean isReviewable, Long categoryId
    ) {
        Product product = productRepository.findById(item.getProductId()).orElse(null);
        SubFeature subFeature = (item.getSubFeatureId() == null) ? null
            : subFeatureRepository.findById(item.getSubFeatureId()).orElse(null);

        Integer templateVersion = null;
        if (item.getTemplateId() != null) {
            templateVersion = templateRepository.findById(item.getTemplateId())
                .map(EstimateTemplate::getVersionNumber).orElse(null);
        }

        String reviewerName = null;
        String reviewerStatus;
        if (item.getReviewerId() == null) {
            reviewerStatus = "unclaimed";
        } else if (item.getReviewerId().equals(actor.getId())) {
            reviewerStatus = "you";
            reviewerName = actor.fullName();
        } else {
            reviewerStatus = "other-so";
            reviewerName = userRepository.findById(item.getReviewerId())
                .map(User::fullName).orElse("Deleted user");
        }

        // Phase lines from the snapshot table
        List<EstimateRequestPhaseLineView> lines = phaseLineRepository
            .findAllByItemIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(item.getId())
            .stream().map(l -> new EstimateRequestPhaseLineView(
                l.getSdlcPhaseId(),
                l.getSdlcPhaseNameSnapshot(),
                l.getSdlcPhaseDisplayOrderSnapshot(),
                l.getOnshoreLow(), l.getOnshoreMed(), l.getOnshoreHigh(),
                l.getOffshoreLow(), l.getOffshoreMed(), l.getOffshoreHigh(),
                l.getOnshoreOverride(), l.getOffshoreOverride()
            )).toList();

        // Answers
        List<CriticalQuestion> liveQuestions = loadQuestionsForItem(item);
        Map<Long, EstimateRequestQuestionAnswer> answerRows =
            answerRepository.findAllByItemId(item.getId()).stream()
                .collect(Collectors.toMap(
                    EstimateRequestQuestionAnswer::getCriticalQuestionId, a -> a
                ));
        Map<Long, List<AttachmentMeta>> attachmentsByQuestion =
            attachmentRepository.findMetaByItemId(item.getId()).stream()
                .collect(Collectors.groupingBy(AttachmentMeta::questionId));
        List<EstimateRequestAnswerView> answers = new ArrayList<>();
        for (CriticalQuestion q : liveQuestions) {
            EstimateRequestQuestionAnswer row = answerRows.get(q.getId());
            answers.add(new EstimateRequestAnswerView(
                q.getId(),
                row != null && item.getStatus() != EstimateStatus.DRAFT
                    ? row.getQuestionTextSnapshot()
                    : q.getQuestionText(),
                q.isRequired(),
                q.isDocumentUploadEnabled(),
                q.isDocumentUploadRequired(),
                row == null ? "" : row.getAnswerText(),
                attachmentsByQuestion.getOrDefault(q.getId(), List.of())
            ));
        }
        // Surface answer rows whose question was hard-deleted (defensive)
        Set<Long> liveQuestionIds = liveQuestions.stream()
            .map(CriticalQuestion::getId).collect(Collectors.toSet());
        for (EstimateRequestQuestionAnswer row : answerRows.values()) {
            if (!liveQuestionIds.contains(row.getCriticalQuestionId())) {
                answers.add(new EstimateRequestAnswerView(
                    row.getCriticalQuestionId(),
                    row.getQuestionTextSnapshot(),
                    false,
                    false,
                    false,
                    row.getAnswerText(),
                    attachmentsByQuestion.getOrDefault(row.getCriticalQuestionId(), List.of())
                ));
            }
        }

        String teamName = (product != null && product.getTeam() != null)
            ? product.getTeam().getName() : null;

        // Resolve original product name for swap-history display
        String originalProductName = null;
        if (item.getOriginalProductId() != null) {
            originalProductName = productRepository.findById(item.getOriginalProductId())
                .map(Product::getName).orElse("Deleted product");
        }

        // Pricing: use snapshotted values for APPROVED items; resolve live config otherwise
        EffectivePricingDto pricing;
        if (item.getStatus() == EstimateStatus.APPROVED
                && item.getApprovedPricingModel() != null) {
            pricing = new EffectivePricingDto(
                item.getApprovedPricingModel(),
                item.getApprovedTmMultiplier(),
                item.getApprovedTmTargetMarginPct(),
                item.getApprovedMatBillableRate(),
                item.getApprovedMatDiscountPct()
            );
        } else {
            pricing = clientPricingService.getEffectivePricingForCategory(categoryId);
        }

        return new EstimateRequestItemDto(
            item.getId(),
            item.getProductId(),
            product == null ? "Deleted product" : product.getName(),
            item.getSubFeatureId(),
            subFeature == null ? null : subFeature.getName(),
            teamName,
            item.getTemplateId(),
            templateVersion,
            item.getStatus(),
            item.getComplexity(),
            item.getReviewerId(),
            reviewerName,
            reviewerStatus,
            item.getJustification(),
            item.getSubmittedAt(),
            item.getReviewedAt(),
            item.getApprovedBlendedRateId(),
            item.getDisplayOrder(),
            lines,
            answers,
            item.getRejectionReason(),
            item.getRevisionCount(),
            item.getOriginalProductId(),
            originalProductName,
            isReviewable,
            item.getClarificationNote(),
            item.getClarificationResponse(),
            pricing.pricingModel(),
            pricing.tmMultiplier(),
            pricing.tmTargetMarginPct(),
            pricing.matBillableRate(),
            pricing.matDiscountPct(),
            item.getRmPricingModel(),
            item.getRmTmMultiplier(),
            item.getRmTmTargetMarginPct(),
            item.getRmMatBillableRate(),
            item.getRmMatDiscountPct(),
            item.getItemType()
        );
    }

    private EstimateRequestListItem toListItem(
        EstimateRequest request,
        List<EstimateRequestItem> items,
        Map<Long, String> productNames,
        Map<Long, String> subNames,
        Map<Long, String> userNames,
        Map<Long, Integer> answeredByItemId,
        Map<Long, Integer> totalByItemId
    ) {
        String derivedStatus = computeDerivedStatus(items, request);

        // Build display string: "Product A, Sub B; Product C" etc., truncated at 3
        List<String> nameList = new ArrayList<>();
        for (EstimateRequestItem item : items) {
            String pName = productNames.getOrDefault(item.getProductId(), "Deleted product");
            if (item.getSubFeatureId() != null) {
                String sName = subNames.getOrDefault(item.getSubFeatureId(), "Deleted sub-feature");
                nameList.add(pName + " / " + sName);
            } else {
                nameList.add(pName);
            }
            if (nameList.size() == 3 && items.size() > 3) {
                nameList.add("+" + (items.size() - 3) + " more");
                break;
            }
        }
        String displayProductNames = String.join(", ", nameList);

        // Earliest non-null submittedAt across items
        OffsetDateTime earliestSubmitted = items.stream()
            .map(EstimateRequestItem::getSubmittedAt)
            .filter(dt -> dt != null)
            .min(OffsetDateTime::compareTo)
            .orElse(null);

        // Requester name — empty map on the self-service surface (myRequests)
        String requesterName = userNames.getOrDefault(request.getRequesterId(), null);

        // Reviewer summary: collect distinct reviewer IDs across items
        Set<Long> reviewerIds = items.stream()
            .map(EstimateRequestItem::getReviewerId)
            .filter(id -> id != null)
            .collect(Collectors.toSet());
        String reviewerSummary;
        if (reviewerIds.isEmpty()) {
            reviewerSummary = "Unclaimed";
        } else if (reviewerIds.size() == 1) {
            reviewerSummary = userNames.getOrDefault(reviewerIds.iterator().next(), "Unknown");
        } else {
            reviewerSummary = "Multiple";
        }

        int approvedItemCount = (int) items.stream()
            .filter(i -> i.getStatus() == EstimateStatus.APPROVED)
            .count();

        // Aggregate question counts across all items on this request.
        int totalQuestionsCount = items.stream()
            .mapToInt(i -> totalByItemId.getOrDefault(i.getId(), 0))
            .sum();
        int answeredQuestionsCount = items.stream()
            .mapToInt(i -> answeredByItemId.getOrDefault(i.getId(), 0))
            .sum();

        return new EstimateRequestListItem(
            request.getId(),
            request.getTitle(),
            derivedStatus,
            items.size(),
            displayProductNames,
            request.getGoLiveDate(),
            earliestSubmitted,
            request.getUpdatedAt(),
            request.getCreatedAt(),
            requesterName,
            reviewerSummary,
            approvedItemCount,
            totalQuestionsCount,
            answeredQuestionsCount,
            request.getRequestType()
        );
    }

    private Map<Long, String> batchLoadUserNames(
        List<EstimateRequest> requests,
        Map<Long, List<EstimateRequestItem>> itemsByRequestId
    ) {
        Set<Long> ids = new HashSet<>();
        requests.forEach(r -> ids.add(r.getRequesterId()));
        itemsByRequestId.values().forEach(items ->
            items.forEach(item -> {
                if (item.getReviewerId() != null) ids.add(item.getReviewerId());
            })
        );
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(User::getId, User::fullName));
    }

    private Map<Long, List<EstimateRequestItem>> loadItemsForRequests(List<Long> requestIds) {
        if (requestIds.isEmpty()) return Map.of();
        // Load all items for the given request IDs
        List<EstimateRequestItem> allItems = new ArrayList<>();
        for (Long rid : requestIds) {
            allItems.addAll(itemRepository.findByEstimateRequestIdOrderByDisplayOrderAsc(rid));
        }
        return allItems.stream()
            .collect(Collectors.groupingBy(EstimateRequestItem::getEstimateRequestId));
    }

    private Map<Long, String> batchLoadProductNames(
        Map<Long, List<EstimateRequestItem>> itemsByRequestId
    ) {
        Set<Long> productIds = itemsByRequestId.values().stream()
            .flatMap(List::stream)
            .map(EstimateRequestItem::getProductId)
            .collect(Collectors.toSet());
        Map<Long, String> names = new HashMap<>();
        productRepository.findAllById(productIds).forEach(p -> names.put(p.getId(), p.getName()));
        return names;
    }

    private Map<Long, String> batchLoadSubNames(
        Map<Long, List<EstimateRequestItem>> itemsByRequestId
    ) {
        Set<Long> subIds = itemsByRequestId.values().stream()
            .flatMap(List::stream)
            .map(EstimateRequestItem::getSubFeatureId)
            .filter(id -> id != null)
            .collect(Collectors.toSet());
        Map<Long, String> names = new HashMap<>();
        subFeatureRepository.findAllById(subIds).forEach(s -> names.put(s.getId(), s.getName()));
        return names;
    }

    /**
     * Returns a map of itemId → answered-question count.
     * Uses a single aggregate query over all item IDs on the page.
     */
    private Map<Long, Integer> batchLoadAnsweredCounts(
        Map<Long, List<EstimateRequestItem>> itemsByRequestId
    ) {
        Set<Long> itemIds = itemsByRequestId.values().stream()
            .flatMap(List::stream)
            .map(EstimateRequestItem::getId)
            .collect(Collectors.toSet());
        if (itemIds.isEmpty()) return Map.of();
        Map<Long, Integer> result = new HashMap<>();
        for (Object[] row : answerRepository.countByItemIds(itemIds)) {
            Long itemId = ((Number) row[0]).longValue();
            int count = ((Number) row[1]).intValue();
            result.put(itemId, count);
        }
        return result;
    }

    /**
     * Returns a map of itemId → total active question count.
     * Each item's count is determined by its product or sub-feature association,
     * using the existing {@code countByProductIdAndActiveTrue} /
     * {@code countBySubFeatureIdAndActiveTrue} methods on the question repository.
     * Results are cached by (productId, subFeatureId) pair so items sharing the
     * same product on the same page only trigger one count query.
     */
    private Map<Long, Integer> batchLoadTotalQuestionCounts(
        Map<Long, List<EstimateRequestItem>> itemsByRequestId
    ) {
        Map<Long, Integer> result = new HashMap<>();
        // Cache: "P:{productId}" or "SF:{subFeatureId}" → count
        Map<String, Integer> cache = new HashMap<>();
        itemsByRequestId.values().stream()
            .flatMap(List::stream)
            .forEach(item -> {
                String cacheKey;
                int count;
                if (item.getSubFeatureId() != null) {
                    cacheKey = "SF:" + item.getSubFeatureId();
                    count = cache.computeIfAbsent(cacheKey,
                        k -> (int) questionRepository.countBySubFeatureIdAndActiveTrue(item.getSubFeatureId()));
                } else {
                    cacheKey = "P:" + item.getProductId();
                    count = cache.computeIfAbsent(cacheKey,
                        k -> (int) questionRepository.countByProductIdAndActiveTrue(item.getProductId()));
                }
                result.put(item.getId(), count);
            });
        return result;
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
