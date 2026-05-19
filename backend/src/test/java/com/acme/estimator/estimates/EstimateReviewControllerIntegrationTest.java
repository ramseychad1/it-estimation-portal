package com.acme.estimator.estimates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.Role;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateLine;
import com.acme.estimator.catalog.templates.EstimateTemplateLineRepository;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.rates.BlendedRateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Phase 9b per-item review endpoints ({@code /api/estimates/review/*}).
 *
 * <p>Actions are now scoped to {@code /{requestId}/items/{itemId}/action}.
 * The old request-level action endpoints (/{id}/start etc.) are removed.
 * Admin send-back lives in {@link AdminSendBackControllerIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EstimateReviewControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EstimateRequestRepository requestRepository;
    @Autowired private EstimateRequestItemRepository itemRepository;
    @Autowired private EstimateRequestPhaseLineRepository phaseLineRepository;
    @Autowired private EstimateRequestQuestionAnswerRepository answerRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private CriticalQuestionRepository questionRepository;
    @Autowired private EstimateTemplateRepository templateRepository;
    @Autowired private EstimateTemplateLineRepository templateLineRepository;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private BlendedRateRepository blendedRateRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @PersistenceContext private EntityManager em;

    private AppUserDetails so1;
    private AppUserDetails so2;
    private AppUserDetails requester;
    private AppUserDetails admin;
    private AppUserDetails requesterOnly;

    private Long seededRateId;

    @BeforeEach
    void setUp() {
        cleanAll();
        so1 = new AppUserDetails(ensureUserWithRoles("so1-review-test@local", "SO", "One", "Solution Owner"));
        so2 = new AppUserDetails(ensureUserWithRoles("so2-review-test@local", "SO", "Two", "Solution Owner"));
        requester = new AppUserDetails(ensureUserWithRoles("requester-review-test@local", "Req", "User", "Requester"));
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        requesterOnly = new AppUserDetails(ensureUserWithRoles("requester-only-review-test@local", "Req", "Only", "Requester"));

        BlendedRate rate = new BlendedRate();
        rate.setOnshoreRate(new BigDecimal("125.00"));
        rate.setOffshoreRate(new BigDecimal("45.00"));
        rate.setEffectiveDate(LocalDate.now().minusDays(1));
        rate.setCreatedBy(1L);
        seededRateId = blendedRateRepository.save(rate).getId();
    }

    @AfterEach
    void tearDown() {
        cleanAll();
        for (String email : List.of(
            "so1-review-test@local", "so2-review-test@local",
            "requester-review-test@local", "requester-only-review-test@local"
        )) {
            userRepository.findByEmailIgnoreCase(email).ifPresent(userRepository::delete);
        }
        if (seededRateId != null) {
            blendedRateRepository.findById(seededRateId).ifPresent(blendedRateRepository::delete);
        }
    }

    private void cleanAll() {
        phaseLineRepository.deleteAll();
        answerRepository.deleteAll();
        itemRepository.deleteAll();
        requestRepository.deleteAll();
        templateLineRepository.deleteAll();
        templateRepository.deleteAll();
        questionRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();
    }

    // ---- security ----------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        mvc.perform(get("/api/estimates/review")).andExpect(status().isUnauthorized());
    }

    @Test
    void nonSO_nonAdmin_returns403() throws Exception {
        mvc.perform(get("/api/estimates/review").with(user(requesterOnly)))
            .andExpect(status().isForbidden());
    }

    @Test
    void adminOnly_canListReviewQueue() throws Exception {
        mvc.perform(get("/api/estimates/review").with(user(admin)))
            .andExpect(status().isOk());
    }

    // ---- queue scope -------------------------------------------------------

    @Test
    void queue_listsSubmittedAndInReview_excludesDraftsAndApproved() throws Exception {
        var ctx = seedSubmittedRequest("Q1");
        Long draftId = createDraft("Drafted", ctx.product.getId(), null);

        // Create, submit, and fully approve a third request
        Long approvedId = createDraft("Approved", ctx.product.getId(), null);
        mvc.perform(asRequester(post("/api/estimates/my/" + approvedId + "/submit")))
            .andExpect(status().isOk());
        Long approvedItemId = firstItemId(approvedId);
        mvc.perform(asSO1(post("/api/estimates/review/" + approvedId + "/items/" + approvedItemId + "/start")))
            .andExpect(status().isOk());
        mvc.perform(asSO1(post("/api/estimates/review/" + approvedId + "/items/" + approvedItemId + "/approve"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "MED", "justification", "OK"))))
            .andExpect(status().isOk());

        // Queue: Q1 (Submitted). Draft and Approved are excluded.
        mvc.perform(asSO1(get("/api/estimates/review")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].id").value(ctx.requestId));

        EstimateRequestItem draftItem = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(draftId).get(0);
        assertThat(draftItem.getStatus()).isEqualTo(EstimateStatus.DRAFT);
    }

    @Test
    void queue_mineOnly_returnsOnlyClaimedByCaller() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long aId = submitDraft(ctx, "Mine");
        Long bId = submitDraft(ctx, "Theirs");

        mvc.perform(asSO1(post("/api/estimates/review/" + aId + "/items/" + firstItemId(aId) + "/start")))
            .andExpect(status().isOk());
        mvc.perform(asSO2(post("/api/estimates/review/" + bId + "/items/" + firstItemId(bId) + "/start")))
            .andExpect(status().isOk());

        mvc.perform(asSO1(get("/api/estimates/review").param("mineOnly", "true")))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].id").value(aId));
    }

    @Test
    void queue_searchByTitle_isSubstringCaseInsensitive() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        submitDraft(ctx, "Member Portal v2");
        submitDraft(ctx, "Provider Refresh");

        mvc.perform(asSO1(get("/api/estimates/review").param("search", "MEMBER")))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].title").value("Member Portal v2"));
    }

    // ---- detail / privacy --------------------------------------------------

    @Test
    void getDetail_onDraft_returns404PrivacyPosture() throws Exception {
        var ctx = seedAtomicProductContext();
        Long draftId = createDraft("Hidden", ctx.product.getId(), null);
        mvc.perform(asSO1(get("/api/estimates/review/" + draftId)))
            .andExpect(status().isNotFound());
    }

    @Test
    void getDetail_onSubmitted_returnsFullSnapshot() throws Exception {
        var ctx = seedSubmittedRequest("Ready");
        mvc.perform(asSO1(get("/api/estimates/review/" + ctx.requestId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("SUBMITTED"))
            .andExpect(jsonPath("$.items[0].phaseLines.length()").value(1))
            .andExpect(jsonPath("$.items[0].reviewerStatus").value("unclaimed"));
    }

    // ---- startItemReview ---------------------------------------------------

    @Test
    void startItemReview_onSubmitted_succeedsAndWritesAuditRow() throws Exception {
        var ctx = seedSubmittedRequest("Claim Test");

        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/start")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("IN_REVIEW"))
            .andExpect(jsonPath("$.items[0].reviewerId").value(so1.getUserId()))
            .andExpect(jsonPath("$.items[0].reviewerStatus").value("you"));

        long startedRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, ctx.requestId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.ITEM_REVIEW_STARTED)
            .count();
        assertThat(startedRows).isEqualTo(1);
    }

    @Test
    void startItemReview_byOtherSO_returns409WithReviewerName() throws Exception {
        var ctx = seedSubmittedRequest("Race");
        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/start")))
            .andExpect(status().isOk());

        mvc.perform(asSO2(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/start")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("ALREADY_IN_REVIEW"))
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("SO One")));
    }

    @Test
    void startItemReview_bySameSO_isIdempotent() throws Exception {
        var ctx = seedSubmittedRequest("Idempotent");
        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/start")))
            .andExpect(status().isOk());

        long beforeRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, ctx.requestId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.ITEM_REVIEW_STARTED)
            .count();

        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/start")))
            .andExpect(status().isOk());

        long afterRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, ctx.requestId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.ITEM_REVIEW_STARTED)
            .count();
        assertThat(afterRows).isEqualTo(beforeRows);
    }

    // ---- releaseItemReview -------------------------------------------------

    @Test
    void releaseItemReview_byReviewer_succeedsAndClearsClaim() throws Exception {
        var ctx = seedInReviewRequest("Release", so1);
        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/release")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("SUBMITTED"))
            .andExpect(jsonPath("$.items[0].reviewerId").doesNotExist());
    }

    @Test
    void releaseItemReview_byOtherSO_returns403NotTheReviewer() throws Exception {
        var ctx = seedInReviewRequest("WrongSO", so1);
        mvc.perform(asSO2(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/release")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("NOT_THE_REVIEWER"));
    }

    // ---- approveItem -------------------------------------------------------

    @Test
    void approveItem_happyPath_setsBlendedRateSnapshotAndReviewedAt() throws Exception {
        var ctx = seedInReviewRequest("Happy", so1);

        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/approve"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "complexity", "MED",
                    "justification", "Validated answers; mid-complexity is correct"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("APPROVED"))
            .andExpect(jsonPath("$.items[0].complexity").value("MED"))
            .andExpect(jsonPath("$.items[0].approvedBlendedRateId").value(seededRateId))
            .andExpect(jsonPath("$.items[0].reviewedAt").exists());

        long approvedRows = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, ctx.requestId
        ).stream().filter(r -> r.getAction() == ChangeAction.ITEM_APPROVED).count();
        assertThat(approvedRows).isEqualTo(1);
    }

    @Test
    void approveItem_withoutComplexity_returns400() throws Exception {
        var ctx = seedInReviewRequest("NoComplexity", so1);
        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/approve"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void approveItem_onSubmittedItem_returns409() throws Exception {
        var ctx = seedSubmittedRequest("State on submitted");
        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/approve"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "MED"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    // ---- rejectItem --------------------------------------------------------

    @Test
    void rejectItem_happyPath_capturesRejectionReason() throws Exception {
        var ctx = seedInReviewRequest("RejectMe", so1);
        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/reject"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rejectionReason", "Question 1 answer is incomplete"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("REJECTED"))
            .andExpect(jsonPath("$.items[0].rejectionReason").value("Question 1 answer is incomplete"))
            .andExpect(jsonPath("$.items[0].complexity").doesNotExist());
    }

    @Test
    void rejectItem_withoutReason_returns400() throws Exception {
        var ctx = seedInReviewRequest("RejectNoReason", so1);
        mvc.perform(asSO1(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/reject"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rejectionReason", ""))))
            .andExpect(status().isBadRequest());
    }

    // ---- helpers -----------------------------------------------------------

    private record AtomicCtx(Product product, SdlcPhase phase) {}
    private record RequestCtx(Long requestId, Long itemId, Product product, SdlcPhase phase) {}

    private Long firstItemId(Long requestId) {
        return itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(requestId)
            .get(0).getId();
    }

    private AtomicCtx seedAtomicProductContext() {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 5, 10, 15, 2, 4, 6);
        return new AtomicCtx(product, phase);
    }

    private RequestCtx seedSubmittedRequest(String title) throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long requestId = submitDraft(ctx, title);
        Long itemId = firstItemId(requestId);
        return new RequestCtx(requestId, itemId, ctx.product, ctx.phase);
    }

    private Long submitDraft(AtomicCtx ctx, String title) throws Exception {
        Long draftId = createDraft(title, ctx.product.getId(), null);
        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isOk());
        return draftId;
    }

    private RequestCtx seedInReviewRequest(String title, AppUserDetails reviewer) throws Exception {
        RequestCtx ctx = seedSubmittedRequest(title);
        mvc.perform(post("/api/estimates/review/" + ctx.requestId + "/items/" + ctx.itemId + "/start")
            .with(user(reviewer)).with(csrf()))
            .andExpect(status().isOk());
        return ctx;
    }

    private Long createDraft(String title, Long productId, Long subFeatureId) throws Exception {
        var item = new java.util.HashMap<String, Object>();
        item.put("productId", productId);
        if (subFeatureId != null) item.put("subFeatureId", subFeatureId);
        var body = new java.util.HashMap<String, Object>();
        body.put("title", title);
        body.put("categoryId", 1);
        body.put("programTypeIds", List.of(1));
        body.put("clientId", 1);
        body.put("programId", 1);
        body.put("items", List.of(item));
        String responseBody = mvc.perform(post("/api/estimates/my")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return ((Number) json.readValue(responseBody, Map.class).get("id")).longValue();
    }

    private SdlcPhase seedPhase(String name, int order) {
        SdlcPhase p = new SdlcPhase();
        p.setName(name);
        p.setDisplayOrder(order);
        p.setActive(true);
        p.setSystem(false);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return phaseRepository.save(p);
    }

    private Product seedAtomicProduct(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private EstimateTemplate seedActiveTemplate(Long productId, Long subFeatureId, int versionNumber) {
        EstimateTemplate t = new EstimateTemplate();
        t.setProductId(productId);
        t.setSubFeatureId(subFeatureId);
        t.setVersionNumber(versionNumber);
        t.setActive(true);
        t.setCreatedBy(1L);
        return templateRepository.save(t);
    }

    private void seedTemplateLine(
        Long templateId, Long phaseId,
        int onLow, int onMed, int onHigh, int offLow, int offMed, int offHigh
    ) {
        EstimateTemplateLine l = new EstimateTemplateLine();
        l.setTemplateId(templateId);
        l.setSdlcPhaseId(phaseId);
        l.setOnshoreLow(BigDecimal.valueOf(onLow));
        l.setOnshoreMed(BigDecimal.valueOf(onMed));
        l.setOnshoreHigh(BigDecimal.valueOf(onHigh));
        l.setOffshoreLow(BigDecimal.valueOf(offLow));
        l.setOffshoreMed(BigDecimal.valueOf(offMed));
        l.setOffshoreHigh(BigDecimal.valueOf(offHigh));
        templateLineRepository.save(l);
    }

    private User ensureUserWithRoles(String email, String first, String last, String roleName) {
        return userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            short roleId = switch (roleName) {
                case "Admin"          -> (short) 1;
                case "Solution Owner" -> (short) 2;
                case "Estimator"      -> (short) 3;
                case "Requester"      -> (short) 4;
                default -> throw new IllegalArgumentException("Unknown role: " + roleName);
            };
            Role role = em.find(Role.class, roleId);
            if (role == null) throw new IllegalStateException(roleName + " role missing");
            User u = new User();
            u.setEmail(email);
            u.setPasswordHash(passwordEncoder.encode("ChangeMe123!"));
            u.setFirstName(first);
            u.setLastName(last);
            u.setActive(true);
            u.setRoles(new HashSet<>(List.of(role)));
            return userRepository.save(u);
        });
    }

    private MockHttpServletRequestBuilder asSO1(MockHttpServletRequestBuilder b) {
        return b.with(user(so1)).with(csrf());
    }
    private MockHttpServletRequestBuilder asSO2(MockHttpServletRequestBuilder b) {
        return b.with(user(so2)).with(csrf());
    }
    private MockHttpServletRequestBuilder asRequester(MockHttpServletRequestBuilder b) {
        return b.with(user(requester)).with(csrf());
    }
}
