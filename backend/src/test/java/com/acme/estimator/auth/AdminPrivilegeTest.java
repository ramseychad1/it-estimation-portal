package com.acme.estimator.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateLine;
import com.acme.estimator.catalog.templates.EstimateTemplateLineRepository;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import com.acme.estimator.estimates.EstimateRequest;
import com.acme.estimator.estimates.EstimateRequestPhaseLineRepository;
import com.acme.estimator.estimates.EstimateRequestQuestionAnswerRepository;
import com.acme.estimator.estimates.EstimateRequestRepository;
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

/**
 * Phase 7.5: Admin role implies every other role for AUTHORIZATION
 * purposes (catalog browse, estimate request submission, review
 * actions). The implication is at the {@code @PreAuthorize} layer, not
 * a data migration — {@code user_roles} stays as the actual list of
 * roles assigned.
 *
 * <p>This test class pins the eight key cases from the phase prompt:
 * <ol>
 *   <li>Admin (no other roles) can list catalog products → 200</li>
 *   <li>Admin (no other roles) can create an estimate request → 201</li>
 *   <li>Admin can VIEW another user's estimate request → 200</li>
 *   <li>Admin canNOT EDIT another user's Draft → 404 (carve-out)</li>
 *   <li>Admin canNOT submit another user's Draft → 404 (carve-out)</li>
 *   <li>Admin can claim a review → 200</li>
 *   <li>Admin can release a review claimed by another SO → 200 (override)</li>
 *   <li>Admin can approve a review claimed by another SO → 200 (override)</li>
 * </ol>
 *
 * <p>The carve-outs (#4, #5) are the deliberate Phase 7.5 boundary:
 * Admin can VIEW everything but cannot EDIT-AS-USER on someone else's
 * private workspace. The override (#7, #8) is the deliberate safety
 * valve for admins to push stuck reviews through.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class AdminPrivilegeTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EstimateRequestRepository requestRepository;
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

    private AppUserDetails adminOnly;     // Admin role only — the implication subject
    private AppUserDetails so1;           // primary SO
    private AppUserDetails requester;     // owns the Draft

    private Long seededRateId;

    @BeforeEach
    void setUp() {
        cleanAll();
        // admin@local from the dev seed has Admin role only — exactly
        // the fixture this test wants. No need for a custom user.
        adminOnly = new AppUserDetails(
            userRepository.findByEmailIgnoreCase("admin@local").orElseThrow()
        );
        so1 = new AppUserDetails(ensureUserWithRoles(
            "so1-priv-test@local", "SO", "One", "Solution Owner"
        ));
        requester = new AppUserDetails(ensureUserWithRoles(
            "requester-priv-test@local", "Req", "User", "Requester"
        ));

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
        for (String email : List.of("so1-priv-test@local", "requester-priv-test@local")) {
            userRepository.findByEmailIgnoreCase(email).ifPresent(userRepository::delete);
        }
        if (seededRateId != null) {
            blendedRateRepository.findById(seededRateId).ifPresent(blendedRateRepository::delete);
        }
    }

    private void cleanAll() {
        phaseLineRepository.deleteAll();
        answerRepository.deleteAll();
        requestRepository.deleteAll();
        templateLineRepository.deleteAll();
        templateRepository.deleteAll();
        questionRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();
    }

    // ---- 1) Catalog browse -------------------------------------------------

    @Test
    void adminOnly_canListCatalogProducts() throws Exception {
        // Catalog list controller already used hasAnyRole('ADMIN','SO'),
        // so this case was passing before 7.5 — it pins the contract.
        mvc.perform(get("/api/catalog/products").with(user(adminOnly)))
            .andExpect(status().isOk());
    }

    // ---- 2) Estimate-request creation --------------------------------------

    @Test
    void adminOnly_canCreateEstimateRequest() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        mvc.perform(post("/api/estimates/my")
                .with(user(adminOnly)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "title", "Admin's own draft",
                    "productId", ctx.product.getId()
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.requesterId").value(adminOnly.getUserId()));
    }

    // ---- 3) Cross-user GET broadens to "owner OR admin" --------------------

    @Test
    void adminOnly_canViewAnotherUsersDraft() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long otherDraftId = createDraftAs(requester, "Their draft", ctx.product.getId());

        // Pre-7.5 this returned 404 (privacy posture). Post-7.5 admin
        // can view via the implication.
        mvc.perform(get("/api/estimates/my/" + otherDraftId).with(user(adminOnly)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(otherDraftId))
            .andExpect(jsonPath("$.requesterId").value(requester.getUserId()));
    }

    // ---- 4) Carve-out: cannot EDIT another user's Draft --------------------

    @Test
    void adminOnly_cannotEditAnotherUsersDraft_returns404() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long otherDraftId = createDraftAs(requester, "Their draft", ctx.product.getId());

        // Drafts are private workspace; admin can VIEW (above) but not
        // edit-as-user. The 404 (not 403) keeps the privacy shape — the
        // owner sees the same response shape whether the request is
        // theirs or doesn't exist.
        mvc.perform(patch("/api/estimates/my/" + otherDraftId)
                .with(user(adminOnly)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("title", "Hijacked"))))
            .andExpect(status().isNotFound());
    }

    // ---- 5) Carve-out: cannot SUBMIT another user's Draft ------------------

    @Test
    void adminOnly_cannotSubmitAnotherUsersDraft_returns404() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long otherDraftId = createDraftAs(requester, "Their draft", ctx.product.getId());

        mvc.perform(post("/api/estimates/my/" + otherDraftId + "/submit")
                .with(user(adminOnly)).with(csrf()))
            .andExpect(status().isNotFound());
    }

    // ---- 6) Admin can claim a review ---------------------------------------

    @Test
    void adminOnly_canClaimAReview() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long submittedId = submitAs(requester, ctx.product.getId(), "To be claimed");

        mvc.perform(post("/api/estimates/review/" + submittedId + "/start")
                .with(user(adminOnly)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_REVIEW"))
            .andExpect(jsonPath("$.reviewerId").value(adminOnly.getUserId()));
    }

    // ---- 7) Admin override: release a review claimed by another SO --------

    @Test
    void adminOnly_canReleaseAReviewClaimedByAnotherSO() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long submittedId = submitAs(requester, ctx.product.getId(), "Override release");
        // SO1 claims it.
        mvc.perform(post("/api/estimates/review/" + submittedId + "/start")
                .with(user(so1)).with(csrf()))
            .andExpect(status().isOk());

        // Pre-7.5 this would 403 NOT_THE_REVIEWER. Post-7.5 admin
        // overrides.
        mvc.perform(post("/api/estimates/review/" + submittedId + "/release")
                .with(user(adminOnly)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"))
            .andExpect(jsonPath("$.reviewerId").doesNotExist());

        // Audit row attributes the action to the admin.
        long rows = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, submittedId
        ).stream()
            .filter(r -> r.getAction() == ChangeAction.REVIEW_RELEASED
                && adminOnly.getUserId().equals(r.getChangedBy()))
            .count();
        assertThat(rows).isEqualTo(1);
    }

    // ---- 8) Admin override: approve a review claimed by another SO --------

    @Test
    void adminOnly_canApproveAReviewClaimedByAnotherSO() throws Exception {
        AtomicCtx ctx = seedAtomicProductContext();
        Long submittedId = submitAs(requester, ctx.product.getId(), "Override approve");
        mvc.perform(post("/api/estimates/review/" + submittedId + "/start")
                .with(user(so1)).with(csrf()))
            .andExpect(status().isOk());

        // Set complexity + justification as the override admin (could
        // also have been done by the original SO — autosave doesn't
        // require that the saver match the reviewer per Phase 7.5).
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .put("/api/estimates/review/" + submittedId + "/state")
                .with(user(adminOnly)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "complexity", "MED",
                    "justification", "Admin override; pushing through"
                ))))
            .andExpect(status().isOk());

        mvc.perform(post("/api/estimates/review/" + submittedId + "/approve")
                .with(user(adminOnly)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPROVED"))
            .andExpect(jsonPath("$.reviewedAt").exists());

        // Reviewer_id stays as the original SO — we don't lose the SO
        // who was on the hook.
        EstimateRequest after = requestRepository.findById(submittedId).orElseThrow();
        assertThat(after.getReviewerId()).isEqualTo(so1.getUserId());

        // Audit row attributes the APPROVED action to the admin.
        long rows = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, submittedId
        ).stream()
            .filter(r -> r.getAction() == ChangeAction.APPROVED
                && adminOnly.getUserId().equals(r.getChangedBy()))
            .count();
        assertThat(rows).isEqualTo(1);
    }

    // ---- helpers -----------------------------------------------------------

    private record AtomicCtx(Product product, SdlcPhase phase) {}

    private AtomicCtx seedAtomicProductContext() {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 5, 10, 15, 2, 4, 6);
        return new AtomicCtx(product, phase);
    }

    private Long createDraftAs(AppUserDetails as, String title, Long productId) throws Exception {
        var body = new java.util.HashMap<String, Object>();
        body.put("title", title);
        body.put("productId", productId);
        String responseBody = mvc.perform(post("/api/estimates/my")
                .with(user(as)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return ((Number) json.readValue(responseBody, Map.class).get("id")).longValue();
    }

    private Long submitAs(AppUserDetails as, Long productId, String title) throws Exception {
        Long id = createDraftAs(as, title, productId);
        mvc.perform(post("/api/estimates/my/" + id + "/submit").with(user(as)).with(csrf()))
            .andExpect(status().isOk());
        return id;
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

}
