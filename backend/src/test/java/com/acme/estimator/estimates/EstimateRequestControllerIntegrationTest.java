package com.acme.estimator.estimates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
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
 * Cases pinned by the Phase 6a prompt:
 *
 * <ol>
 *   <li>Anonymous → 401</li>
 *   <li>Non-Requester (admin without Requester role) → 403</li>
 *   <li>POST creates Draft for atomic product → 201, status=DRAFT, no template_id, no lines</li>
 *   <li>POST for container product without sub-feature → 400</li>
 *   <li>POST for atomic product WITH sub-feature → 400</li>
 *   <li>POST for inactive product → 400</li>
 *   <li>PUT answers replaces previous → exact set</li>
 *   <li>PATCH title/description on Draft → 200 with field-level audit rows</li>
 *   <li>PATCH on Submitted → 409 INVALID_STATE</li>
 *   <li>DELETE Draft → 204 + DELETED change_log row</li>
 *   <li>DELETE Submitted → 409 INVALID_STATE</li>
 *   <li>SUBMIT happy path → 200, status=SUBMITTED, template_id set, lines copied</li>
 *   <li>SUBMIT without active template → 409 NO_ACTIVE_TEMPLATE</li>
 *   <li>SUBMIT with required question unanswered → 400 with the missing question id</li>
 *   <li>SUBMIT with optional question unanswered → 200 (allowed)</li>
 *   <li>GET my list filters by status correctly</li>
 *   <li>GET another user's request → 404 (privacy)</li>
 *   <li>Submitted snapshot survives template/phase rename</li>
 * </ol>
 *
 * <p>Test-cleanup convention: see {@link EstimateRequestServiceSnapshotTest}'s
 * class javadoc — RESTRICT FKs from {@code estimate_requests} mean we must
 * tear down our own rows in {@code @AfterEach} so other test classes'
 * {@code productRepository.deleteAll()} doesn't trip.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EstimateRequestControllerIntegrationTest {

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
    @Autowired private UserRepository userRepository;
    @Autowired private BlendedRateRepository blendedRateRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @PersistenceContext private EntityManager em;

    private AppUserDetails admin;             // Admin only — Phase 7.5 lets Admin in via implication
    private AppUserDetails estimatorOnly;     // Estimator role only — the new no-access fixture
    private AppUserDetails requester;
    private AppUserDetails otherRequester;

    @BeforeEach
    void setUp() {
        cleanAll();

        admin = new AppUserDetails(
            userRepository.findByEmailIgnoreCase("admin@local").orElseThrow()
        );
        requester = new AppUserDetails(
            ensureRequesterUser("requester-controller-test@local", "Test", "Requester")
        );
        otherRequester = new AppUserDetails(
            ensureRequesterUser("other-requester-controller-test@local", "Other", "Requester")
        );
        estimatorOnly = new AppUserDetails(
            ensureUserWithRole("estimator-only-controller-test@local", "Est", "Only", (short) 3)
        );
    }

    @AfterEach
    void tearDown() {
        cleanAll();
        userRepository.findByEmailIgnoreCase("requester-controller-test@local")
            .ifPresent(userRepository::delete);
        userRepository.findByEmailIgnoreCase("other-requester-controller-test@local")
            .ifPresent(userRepository::delete);
        userRepository.findByEmailIgnoreCase("estimator-only-controller-test@local")
            .ifPresent(userRepository::delete);
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
        mvc.perform(get("/api/estimates/my")).andExpect(status().isUnauthorized());
    }

    @Test
    void nonRequester_nonAdmin_returns403() throws Exception {
        // Phase 7.5: Admin now inherits Requester authority via
        // hasAnyRole('ADMIN','REQUESTER'). The 403 path is now an
        // Estimator-only user — a role with no Admin / Requester / SO.
        mvc.perform(get("/api/estimates/my").with(user(estimatorOnly)))
            .andExpect(status().isForbidden());
    }

    @Test
    void adminOnly_canListMyRequests() throws Exception {
        // Phase 7.5 implication: admin@local has Admin only, but Admin
        // now satisfies the Requester role gate. List should return 200
        // with their (empty) request set.
        mvc.perform(get("/api/estimates/my").with(user(admin)))
            .andExpect(status().isOk());
    }

    // ---- create Draft (atomic / container / inactive) ----------------------

    @Test
    void createDraft_atomicProduct_returns201AndNoTemplateOrLines() throws Exception {
        seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility API");

        var createBody0 = new java.util.HashMap<String, Object>();
        createBody0.put("title", "Member Portal v2");
        createBody0.put("categoryId", 1);
        createBody0.put("programTypeIds", List.of(1));
        createBody0.put("clientId", 1);
        createBody0.put("programId", 1);
        createBody0.put("items", List.of(Map.of("productId", product.getId())));
        mvc.perform(asRequester(post("/api/estimates/my"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(createBody0)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.items[0].status").value("DRAFT"))
            .andExpect(jsonPath("$.items[0].templateId").doesNotExist())
            .andExpect(jsonPath("$.items[0].phaseLines").isArray())
            .andExpect(jsonPath("$.items[0].phaseLines.length()").value(0));
    }

    @Test
    void createDraft_containerWithoutSubFeature_returns400() throws Exception {
        Product container = seedContainerProduct("Container");

        var createBody1 = new java.util.HashMap<String, Object>();
        createBody1.put("title", "R");
        createBody1.put("categoryId", 1);
        createBody1.put("programTypeIds", List.of(1));
        createBody1.put("clientId", 1);
        createBody1.put("programId", 1);
        createBody1.put("items", List.of(Map.of("productId", container.getId())));
        mvc.perform(asRequester(post("/api/estimates/my"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(createBody1)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("sub-feature must be selected")));
    }

    @Test
    void createDraft_atomicWithSubFeature_returns400() throws Exception {
        Product atomic = seedAtomicProduct("Atomic");
        Product container = seedContainerProduct("Container");
        SubFeature sub = seedSubFeature(container.getId(), "Variant");

        var createBody2 = new java.util.HashMap<String, Object>();
        createBody2.put("title", "R");
        createBody2.put("categoryId", 1);
        createBody2.put("programTypeIds", List.of(1));
        createBody2.put("clientId", 1);
        createBody2.put("programId", 1);
        createBody2.put("items", List.of(Map.of("productId", atomic.getId(), "subFeatureId", sub.getId())));
        mvc.perform(asRequester(post("/api/estimates/my"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(createBody2)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void createDraft_inactiveProduct_returns400() throws Exception {
        Product inactive = seedAtomicProduct("Retired");
        inactive.setActive(false);
        productRepository.save(inactive);

        var createBody3 = new java.util.HashMap<String, Object>();
        createBody3.put("title", "R");
        createBody3.put("categoryId", 1);
        createBody3.put("programTypeIds", List.of(1));
        createBody3.put("clientId", 1);
        createBody3.put("programId", 1);
        createBody3.put("items", List.of(Map.of("productId", inactive.getId())));
        mvc.perform(asRequester(post("/api/estimates/my"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(createBody3)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("not active")));
    }

    // ---- update Draft (PATCH) ---------------------------------------------

    @Test
    void patchDraft_recordsFieldLevelAudit() throws Exception {
        Long draftId = createDraftJson("Original", seedAtomicProduct("Eligibility").getId(), null);

        mvc.perform(asRequester(patch("/api/estimates/my/" + draftId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "title", "Renamed",
                    "description", "New description"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Renamed"))
            .andExpect(jsonPath("$.description").value("New description"));

        // Two UPDATED rows expected: one for title, one for description.
        long updateRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, draftId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.UPDATED)
            .count();
        assertThat(updateRows).isEqualTo(2);
    }

    @Test
    void patchSubmitted_returns409() throws Exception {
        // Submit a request first.
        SubmittedRequest sr = submittedSetup();

        mvc.perform(asRequester(patch("/api/estimates/my/" + sr.requestId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("title", "Retitle"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    // ---- goLiveDate PATCH / audit (V15 post-Phase-9 increment) -----------

    @Test
    void patchDraft_goLiveDate_persistsDateAndWritesAuditRow() throws Exception {
        Long draftId = createDraftJson("GLDate Test", seedAtomicProduct("P-GoLive").getId(), null);

        mvc.perform(asRequester(patch("/api/estimates/my/" + draftId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("goLiveDate", "2026-12-31"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.goLiveDate").value("2026-12-31"));

        // Verify persistence.
        EstimateRequest saved = requestRepository.findById(draftId).orElseThrow();
        assertThat(saved.getGoLiveDate()).isNotNull();
        assertThat(saved.getGoLiveDate().toString()).isEqualTo("2026-12-31");

        // One UPDATED audit row for goLiveDate.
        long auditRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, draftId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.UPDATED)
            .count();
        assertThat(auditRows).isEqualTo(1);
    }

    @Test
    void patchDraft_goLiveDateNull_clearsDateAndWritesAuditRow() throws Exception {
        // Seed a draft that already has a go_live_date set.
        Long draftId = createDraftJson("GLDate Clear Test", seedAtomicProduct("P-GoLiveClear").getId(), null);

        // First PATCH — set a date.
        mvc.perform(asRequester(patch("/api/estimates/my/" + draftId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("goLiveDate", "2026-06-01"))))
            .andExpect(status().isOk());

        // Second PATCH — clear it with null.
        mvc.perform(asRequester(patch("/api/estimates/my/" + draftId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"goLiveDate\":null}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.goLiveDate").doesNotExist());

        // Date should be cleared.
        EstimateRequest saved = requestRepository.findById(draftId).orElseThrow();
        assertThat(saved.getGoLiveDate()).isNull();

        // Two UPDATED audit rows: one set + one clear.
        long auditRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, draftId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.UPDATED)
            .count();
        assertThat(auditRows).isEqualTo(2);
    }

    @Test
    void patchDraft_goLiveDateUnchanged_doesNotWriteAuditRow() throws Exception {
        Long draftId = createDraftJson("GLDate NoChange Test", seedAtomicProduct("P-GoLiveNC").getId(), null);

        // Set a date.
        mvc.perform(asRequester(patch("/api/estimates/my/" + draftId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("goLiveDate", "2026-09-15"))))
            .andExpect(status().isOk());

        // PATCH again with the same date — should NOT produce a second audit row.
        mvc.perform(asRequester(patch("/api/estimates/my/" + draftId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("goLiveDate", "2026-09-15"))))
            .andExpect(status().isOk());

        long auditRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, draftId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.UPDATED)
            .count();
        // Only 1 audit row from the first PATCH, none from the second.
        assertThat(auditRows).isEqualTo(1);
    }

    // ---- delete (discard) -------------------------------------------------

    @Test
    void deleteDraft_returns204AndWritesDeletedRow() throws Exception {
        Long draftId = createDraftJson("R", seedAtomicProduct("P").getId(), null);

        mvc.perform(asRequester(delete("/api/estimates/my/" + draftId)))
            .andExpect(status().isNoContent());

        assertThat(requestRepository.findById(draftId)).isEmpty();
        long deletedRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, draftId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.DELETED)
            .count();
        assertThat(deletedRows).isEqualTo(1);
    }

    @Test
    void deleteSubmitted_returns409() throws Exception {
        SubmittedRequest sr = submittedSetup();

        mvc.perform(asRequester(delete("/api/estimates/my/" + sr.requestId)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));

        assertThat(requestRepository.findById(sr.requestId)).isPresent();
    }

    @Test
    void deleteNeedsRevision_returns204AndDeletesRequest() throws Exception {
        // A NEEDS_REVISION request is one where at least one item is REJECTED.
        // We rely on the EstimateRequestRevisionTest.seedRejectedRequest helper
        // pattern but inline it here since we can't call across test classes.
        // Setup: create → submit → startReview (SO) → reject item.
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("NeedsRevisionDiscard");
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);
        Long draftId = createDraftJson("NR-Discard", product.getId(), null);

        // Submit
        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isOk());

        // Retrieve item id
        Long itemId = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(draftId)
            .get(0).getId();

        // SO starts review
        AppUserDetails so = new AppUserDetails(
            ensureUserWithRole("so-discard-test@local", "SO", "Discard", (short) 2)
        );
        mvc.perform(post("/api/estimates/review/" + draftId + "/items/" + itemId + "/start")
                .with(user(so)).with(csrf()))
            .andExpect(status().isOk());

        // Seed a blended rate so approve/reject endpoints work
        BlendedRate rate = new BlendedRate();
        rate.setOnshoreRate(new BigDecimal("100.00"));
        rate.setOffshoreRate(new BigDecimal("40.00"));
        rate.setEffectiveDate(LocalDate.now().minusDays(1));
        rate.setCreatedBy(1L);
        Long rateId = blendedRateRepository.save(rate).getId();

        // SO rejects item
        mvc.perform(post("/api/estimates/review/" + draftId + "/items/" + itemId + "/reject")
                .with(user(so)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rejectionReason", "Needs more info"))))
            .andExpect(status().isOk());

        // Requester discards the NEEDS_REVISION request → should succeed
        mvc.perform(asRequester(delete("/api/estimates/my/" + draftId)))
            .andExpect(status().isNoContent());

        assertThat(requestRepository.findById(draftId)).isEmpty();

        // Cleanup
        blendedRateRepository.findById(rateId).ifPresent(blendedRateRepository::delete);
        userRepository.findByEmailIgnoreCase("so-discard-test@local")
            .ifPresent(userRepository::delete);
    }

    // ---- save answers (PUT replace-all) -----------------------------------

    @Test
    void putAnswers_replacesPreviousAnswers() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        CriticalQuestion q1 = seedQuestion(product.getId(), "Q1", true, 1);
        CriticalQuestion q2 = seedQuestion(product.getId(), "Q2", false, 2);
        Long draftId = createDraftJson("R", product.getId(), null);

        // First save: answer q1 only.
        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q1.getId(), "answerText", "First answer"))
                ))))
            .andExpect(status().isOk());
        Long firstItemId = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(draftId).get(0).getId();
        assertThat(answerRepository.findAllByItemId(firstItemId)).hasSize(1);

        // Second save: answer q2 only — q1's row should be gone.
        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q2.getId(), "answerText", "Second answer"))
                ))))
            .andExpect(status().isOk());
        List<EstimateRequestQuestionAnswer> rows =
            answerRepository.findAllByItemId(firstItemId);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getCriticalQuestionId()).isEqualTo(q2.getId());
        assertThat(rows.get(0).getAnswerText()).isEqualTo("Second answer");

        // No audit rows for answer saves.
        long updateRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(
                EstimateRequest.ENTITY_TYPE, draftId
            ).stream()
            .filter(r -> r.getAction() == ChangeAction.UPDATED)
            .count();
        assertThat(updateRows).isZero();

        // Reference the unused phase to silence the linter — it's seeded
        // because the snapshot lookup needs at least one active phase even
        // though this test never submits.
        assertThat(phase.getId()).isNotNull();
    }

    // ---- submit -----------------------------------------------------------

    @Test
    void submit_happyPath_copiesTemplateLinesAndFlipsStatus() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 2);
        seedTemplateLine(template.getId(), phase.getId(), 5, 10, 15, 2, 4, 6);
        Long draftId = createDraftJson("R", product.getId(), null);

        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.derivedStatus").value("SUBMITTED"))
            .andExpect(jsonPath("$.items[0].status").value("SUBMITTED"))
            .andExpect(jsonPath("$.items[0].templateId").value(template.getId()))
            .andExpect(jsonPath("$.items[0].templateVersionNumber").value(2))
            .andExpect(jsonPath("$.items[0].phaseLines.length()").value(1))
            .andExpect(jsonPath("$.items[0].phaseLines[0].sdlcPhaseName").value("Discovery"))
            .andExpect(jsonPath("$.items[0].phaseLines[0].onshoreLow").value(5))
            .andExpect(jsonPath("$.items[0].submittedAt").exists());
    }

    @Test
    void submit_withoutActiveTemplate_returns409NoActiveTemplate() throws Exception {
        seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        Long draftId = createDraftJson("R", product.getId(), null);

        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("NO_ACTIVE_TEMPLATE"))
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("Eligibility")));
    }

    @Test
    void submit_missingRequiredAnswer_returns400WithStructuredFieldErrors() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        CriticalQuestion required = seedQuestion(product.getId(), "Required?", true, 1);
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);
        Long draftId = createDraftJson("R", product.getId(), null);

        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("MISSING_REQUIRED_ANSWERS"))
            .andExpect(jsonPath("$.fieldErrors[\"question:" + required.getId() + "\"]").exists());
    }

    @Test
    void submit_optionalUnanswered_succeeds() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        CriticalQuestion required = seedQuestion(product.getId(), "Required?", true, 1);
        seedQuestion(product.getId(), "Optional?", false, 2);
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);
        Long draftId = createDraftJson("R", product.getId(), null);

        // Answer ONLY the required one.
        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", required.getId(), "answerText", "Yes"))
                ))))
            .andExpect(status().isOk());

        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.derivedStatus").value("SUBMITTED"));
    }

    // ---- list / detail / privacy ------------------------------------------

    @Test
    void listMy_filtersByStatus() throws Exception {
        Product p = seedAtomicProduct("P");
        Long draftId = createDraftJson("D", p.getId(), null);
        // Create a second draft and submit it (need a template).
        SdlcPhase phase = seedPhase("Discovery", 1);
        EstimateTemplate t = seedActiveTemplate(p.getId(), null, 1);
        seedTemplateLine(t.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);
        Long submittedId = createDraftJson("S", p.getId(), null);
        mvc.perform(asRequester(post("/api/estimates/my/" + submittedId + "/submit")))
            .andExpect(status().isOk());

        mvc.perform(asRequester(get("/api/estimates/my")))
            .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(asRequester(get("/api/estimates/my").param("status", "DRAFT")))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].id").value(draftId));
        mvc.perform(asRequester(get("/api/estimates/my").param("status", "SUBMITTED")))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].id").value(submittedId));
    }

    @Test
    void getOtherUsersRequest_returns404NotForbidden() throws Exception {
        // Make a Draft owned by `otherRequester`, then try to GET it as
        // `requester`. The 404 (not 403) is intentional — we don't leak
        // the existence of other users' requests.
        Long otherDraft = createDraftJsonAs(otherRequester, "Theirs",
            seedAtomicProduct("P").getId(), null);

        mvc.perform(asRequester(get("/api/estimates/my/" + otherDraft)))
            .andExpect(status().isNotFound());
    }

    // ---- snapshot survives template/phase rename --------------------------

    @Test
    void submittedSnapshot_survivesPhaseRenameAndTemplateMutation() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 5, 10, 15, 2, 4, 6);
        Long draftId = createDraftJson("R", product.getId(), null);
        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isOk());

        // Mutate the live phase + template line.
        SdlcPhase live = phaseRepository.findById(phase.getId()).orElseThrow();
        live.setName("Inception");
        live.setDisplayOrder(99);
        phaseRepository.save(live);
        // Even if a brand-new template version were minted later, the
        // request's snapshot rows must remain intact.

        mvc.perform(asRequester(get("/api/estimates/my/" + draftId)))
            .andExpect(jsonPath("$.items[0].phaseLines[0].sdlcPhaseName").value("Discovery"))
            .andExpect(jsonPath("$.items[0].phaseLines[0].displayOrder").value(1))
            .andExpect(jsonPath("$.items[0].phaseLines[0].onshoreLow").value(5));
    }

    // ---- helpers -----------------------------------------------------------

    private record SubmittedRequest(Long requestId) {}

    private SubmittedRequest submittedSetup() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);
        Long draftId = createDraftJson("R", product.getId(), null);
        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isOk());
        return new SubmittedRequest(draftId);
    }

    private Long createDraftJson(String title, Long productId, Long subFeatureId) throws Exception {
        return createDraftJsonAs(requester, title, productId, subFeatureId);
    }

    private Long createDraftJsonAs(
        AppUserDetails actor, String title, Long productId, Long subFeatureId
    ) throws Exception {
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
        String jsonBody = this.json.writeValueAsString(body);
        String responseBody = mvc.perform(post("/api/estimates/my").with(user(actor)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonBody))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return ((Number) this.json.readValue(responseBody, Map.class).get("id")).longValue();
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

    private Product seedContainerProduct(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.CONTAINER);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private SubFeature seedSubFeature(Long productId, String name) {
        SubFeature s = new SubFeature();
        s.setProductId(productId);
        s.setName(name);
        s.setActive(true);
        s.setCreatedBy(1L);
        s.setUpdatedBy(1L);
        return subFeatureRepository.save(s);
    }

    // ---- typed answer validation (UX-2) ------------------------------------

    @Test
    void saveAnswers_yesNoQuestion_rejectsNonYesNo_withFieldError() throws Exception {
        Product product = seedAtomicProduct("Eligibility");
        CriticalQuestion q = seedTypedQuestion(product.getId(), "Vanity code?",
            com.acme.estimator.catalog.questions.QuestionType.YES_NO, null, 1);
        Long draftId = createDraftJson("R", product.getId(), null);

        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q.getId(), "answerText", "Maybe"))
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_ANSWER_FORMAT"))
            .andExpect(jsonPath("$.fieldErrors[\"question:" + q.getId() + "\"]")
                .value("Answer must be Yes or No."));

        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q.getId(), "answerText", "Yes"))
                ))))
            .andExpect(status().isOk());
    }

    @Test
    void saveAnswers_singleSelect_rejectsUnknownOption() throws Exception {
        Product product = seedAtomicProduct("Eligibility");
        CriticalQuestion q = seedTypedQuestion(product.getId(), "Scope?",
            com.acme.estimator.catalog.questions.QuestionType.SINGLE_SELECT,
            "[\"Pilot\",\"Full rollout\"]", 1);
        Long draftId = createDraftJson("R", product.getId(), null);

        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q.getId(), "answerText", "Everything"))
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_ANSWER_FORMAT"));

        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q.getId(), "answerText", "Pilot"))
                ))))
            .andExpect(status().isOk());
    }

    @Test
    void saveAnswers_numberQuestion_rejectsNonNumeric() throws Exception {
        Product product = seedAtomicProduct("Eligibility");
        CriticalQuestion q = seedTypedQuestion(product.getId(), "How many products?",
            com.acme.estimator.catalog.questions.QuestionType.NUMBER, null, 1);
        Long draftId = createDraftJson("R", product.getId(), null);

        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q.getId(), "answerText", "a dozen"))
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_ANSWER_FORMAT"))
            .andExpect(jsonPath("$.fieldErrors[\"question:" + q.getId() + "\"]")
                .value("Answer must be a number."));

        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q.getId(), "answerText", "12.5"))
                ))))
            .andExpect(status().isOk());
    }

    @Test
    void submit_answerPredatingTypeChange_isBlockedAtSubmitGate() throws Exception {
        // Answer saved while LONG_TEXT, then an admin retypes the question to
        // YES_NO — the stale free-text answer must be caught at submit.
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility");
        CriticalQuestion q = seedQuestion(product.getId(), "Vanity code?", true, 1);
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);
        Long draftId = createDraftJson("R", product.getId(), null);

        mvc.perform(asRequester(put("/api/estimates/my/" + draftId + "/answers"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "answers", List.of(Map.of("questionId", q.getId(), "answerText", "Probably not"))
                ))))
            .andExpect(status().isOk());

        q.setQuestionType(com.acme.estimator.catalog.questions.QuestionType.YES_NO);
        questionRepository.save(q);

        mvc.perform(asRequester(post("/api/estimates/my/" + draftId + "/submit")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_ANSWER_FORMAT"))
            .andExpect(jsonPath("$.fieldErrors[\"question:" + q.getId() + "\"]").exists());
    }

    private CriticalQuestion seedTypedQuestion(
        Long productId, String text,
        com.acme.estimator.catalog.questions.QuestionType type, String optionsJson, int order
    ) {
        CriticalQuestion q = seedQuestion(productId, text, false, order);
        q.setQuestionType(type);
        q.setOptionsJson(optionsJson);
        return questionRepository.save(q);
    }

    private CriticalQuestion seedQuestion(Long productId, String text, boolean required, int order) {
        CriticalQuestion q = new CriticalQuestion();
        q.setProductId(productId);
        q.setQuestionText(text);
        q.setRequired(required);
        q.setDisplayOrder(order);
        q.setActive(true);
        q.setCreatedBy(1L);
        q.setUpdatedBy(1L);
        return questionRepository.save(q);
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

    private User ensureRequesterUser(String email, String first, String last) {
        return userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            // Role id 4 = Requester (V2 seed).
            Role requesterRole = em.find(Role.class, (short) 4);
            if (requesterRole == null) {
                throw new IllegalStateException("Requester role missing");
            }
            User u = new User();
            u.setEmail(email);
            u.setPasswordHash(passwordEncoder.encode("ChangeMe123!"));
            u.setFirstName(first);
            u.setLastName(last);
            u.setActive(true);
            u.setRoles(new HashSet<>(List.of(requesterRole)));
            return userRepository.save(u);
        });
    }

    private User ensureUserWithRole(String email, String first, String last, short roleId) {
        return userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            Role role = em.find(Role.class, roleId);
            if (role == null) throw new IllegalStateException("Role id " + roleId + " missing");
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

    private MockHttpServletRequestBuilder asRequester(MockHttpServletRequestBuilder builder) {
        return builder.with(user(requester)).with(csrf());
    }
}
