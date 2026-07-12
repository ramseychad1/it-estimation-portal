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
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Team-scoped per-item review cases (Phase 9b).
 *
 * <p>Key invariant: an SO can only start/approve/reject items whose
 * product is assigned to a team they belong to. Admin bypasses the check.
 * Products without a team allow any SO.
 *
 * <p>Also covers: derived status progression through multi-item states,
 * and the idempotency / race-condition guards.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EstimateRequestItemReviewTest {

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
    @Autowired private TeamRepository teamRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;
    @PersistenceContext private EntityManager em;

    private AppUserDetails soTeamA; // SO belonging to Team A only
    private AppUserDetails soTeamB; // SO belonging to Team B only
    private AppUserDetails soNoTeam; // SO with no team membership
    private AppUserDetails requester;
    private AppUserDetails admin;
    private AppUserDetails revenueManager;

    private Team teamA;
    private Team teamB;
    private Long seededRateId;

    @BeforeEach
    void setUp() {
        cleanAll();

        teamA = createTeam("Team Alpha");
        teamB = createTeam("Team Beta");

        User soAUser = ensureUserWithRole("so-team-a@local", "SO", "Alpha", (short) 2);
        User soBUser = ensureUserWithRole("so-team-b@local", "SO", "Beta", (short) 2);
        User soNoneUser = ensureUserWithRole("so-no-team@local", "SO", "None", (short) 2);

        // Wire Team A → soTeamA, Team B → soTeamB; soNoTeam gets no membership
        jdbc.update("INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)", soAUser.getId(), teamA.getId());
        jdbc.update("INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)", soBUser.getId(), teamB.getId());

        soTeamA = new AppUserDetails(soAUser);
        soTeamB = new AppUserDetails(soBUser);
        soNoTeam = new AppUserDetails(soNoneUser);
        requester = new AppUserDetails(ensureUserWithRole("req-team-test@local", "Req", "User", (short) 4));
        revenueManager = new AppUserDetails(ensureUserWithRole("rm-review-test@local", "Rev", "Mgr", (short) 5));
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());

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
            "so-team-a@local", "so-team-b@local", "so-no-team@local", "req-team-test@local", "rm-review-test@local"
        )) {
            userRepository.findByEmailIgnoreCase(email).ifPresent(userRepository::delete);
        }
        if (seededRateId != null) {
            blendedRateRepository.findById(seededRateId).ifPresent(blendedRateRepository::delete);
        }
        teamRepository.findAll().stream()
            .filter(t -> t.getName().startsWith("Team Alpha") || t.getName().startsWith("Team Beta"))
            .forEach(teamRepository::delete);
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

    // ---- team-scoped start -----------------------------------------------

    @Test
    void startItemReview_soOnProductTeam_succeeds() throws Exception {
        var ctx = seedSubmittedRequest(teamA);

        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "start"))
                .with(user(soTeamA)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("IN_REVIEW"))
            .andExpect(jsonPath("$.items[0].reviewerId").value(soTeamA.getUserId()));
    }

    @Test
    void startItemReview_soOnDifferentTeam_returns403NotOnTeam() throws Exception {
        var ctx = seedSubmittedRequest(teamA);

        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "start"))
                .with(user(soTeamB)).with(csrf()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("NOT_ON_TEAM"));
    }

    @Test
    void startItemReview_soWithNoTeams_returns403NotOnTeam() throws Exception {
        var ctx = seedSubmittedRequest(teamA);

        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "start"))
                .with(user(soNoTeam)).with(csrf()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("NOT_ON_TEAM"));
    }

    @Test
    void startItemReview_adminBypassesTeamCheck_succeeds() throws Exception {
        var ctx = seedSubmittedRequest(teamA);

        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "start"))
                .with(user(admin)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("IN_REVIEW"));
    }

    @Test
    void startItemReview_productWithNoTeam_anySOCanReview() throws Exception {
        // Product without a team — the permissive fallback
        var ctx = seedSubmittedRequestNoTeam();

        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "start"))
                .with(user(soNoTeam)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("IN_REVIEW"));
    }

    // ---- derived status progression --------------------------------------

    @Test
    void derivedStatus_progressesThroughMultiItemStates() throws Exception {
        SdlcPhase phase = seedPhase("Requirements", 1);
        Product pA = seedProductWithTeam("Product A", teamA);
        Product pB = seedProductWithTeam("Product B", teamB);
        seedActiveTemplateWithLine(pA.getId(), null, phase.getId());
        seedActiveTemplateWithLine(pB.getId(), null, phase.getId());

        // Create a 2-item request
        var multiBody = new java.util.HashMap<String, Object>();
        multiBody.put("title", "Multi-item");
        multiBody.put("categoryId", 1);
        multiBody.put("programTypeIds", List.of(1));
        multiBody.put("clientId", 1);
        multiBody.put("programId", 1);
        multiBody.put("items", List.of(
            Map.of("productId", pA.getId()),
            Map.of("productId", pB.getId())
        ));
        String body = json.writeValueAsString(multiBody);
        String resp = mvc.perform(post("/api/estimates/my")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        Long reqId = ((Number) json.readValue(resp, Map.class).get("id")).longValue();

        // Submit
        mvc.perform(post("/api/estimates/my/" + reqId + "/submit")
                .with(user(requester)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.derivedStatus").value("SUBMITTED"));

        List<EstimateRequestItem> items =
            itemRepository.findByEstimateRequestIdOrderByDisplayOrderAsc(reqId);
        Long itemAId = items.get(0).getId();
        Long itemBId = items.get(1).getId();

        // Team A SO starts their item → IN_REVIEW
        mvc.perform(post(itemUrl(reqId, itemAId, "start")).with(user(soTeamA)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.derivedStatus").value("IN_REVIEW"));

        // Team A SO approves → PARTIALLY_APPROVED (item B still SUBMITTED)
        mvc.perform(post(itemUrl(reqId, itemAId, "approve")).with(user(soTeamA)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "LOW", "justification", "Straightforward"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.derivedStatus").value("PARTIALLY_APPROVED"));

        // Team B SO starts and approves their item → APPROVED
        mvc.perform(post(itemUrl(reqId, itemBId, "start")).with(user(soTeamB)).with(csrf()))
            .andExpect(status().isOk());
        mvc.perform(post(itemUrl(reqId, itemBId, "approve")).with(user(soTeamB)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "MED", "justification", "Verified"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.derivedStatus").value("APPROVED"));
    }

    @Test
    void derivedStatus_oneRejected_becomesNeedsRevision() throws Exception {
        SdlcPhase phase = seedPhase("Design", 1);
        Product pA = seedProductWithTeam("Rejected Product", teamA);
        seedActiveTemplateWithLine(pA.getId(), null, phase.getId());

        Long reqId = createAndSubmitRequest("Rejection test", pA.getId());
        Long itemId = firstItemId(reqId);

        mvc.perform(post(itemUrl(reqId, itemId, "start")).with(user(soTeamA)).with(csrf()))
            .andExpect(status().isOk());
        mvc.perform(post(itemUrl(reqId, itemId, "reject")).with(user(soTeamA)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rejectionReason", "Answers too vague"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.derivedStatus").value("NEEDS_REVISION"))
            .andExpect(jsonPath("$.items[0].rejectionReason").value("Answers too vague"));
    }

    @Test
    void rejectItem_writesAuditRowAndClearsComplexity() throws Exception {
        SdlcPhase phase = seedPhase("Dev", 1);
        Product p = seedProductWithTeam("Clearance test", teamA);
        seedActiveTemplateWithLine(p.getId(), null, phase.getId());

        Long reqId = createAndSubmitRequest("Audit check", p.getId());
        Long itemId = firstItemId(reqId);

        mvc.perform(post(itemUrl(reqId, itemId, "start")).with(user(soTeamA)).with(csrf()))
            .andExpect(status().isOk());
        mvc.perform(post(itemUrl(reqId, itemId, "reject")).with(user(soTeamA)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rejectionReason", "Missing detail"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].complexity").doesNotExist());

        long rejectedRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(EstimateRequest.ENTITY_TYPE, reqId)
            .stream().filter(r -> r.getAction() == ChangeAction.ITEM_REJECTED).count();
        assertThat(rejectedRows).isEqualTo(1);
    }

    @Test
    void releaseItemReview_soOnDifferentTeam_returns403() throws Exception {
        var ctx = seedInReviewRequest(teamA, soTeamA);

        // soTeamB cannot release soTeamA's claim
        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "release"))
                .with(user(soTeamB)).with(csrf()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("NOT_THE_REVIEWER"));
    }

    @Test
    void approveItem_soOnDifferentTeam_returns403NotTheReviewer() throws Exception {
        var ctx = seedInReviewRequest(teamA, soTeamA);

        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "approve"))
                .with(user(soTeamB)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "LOW"))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("NOT_THE_REVIEWER"));
    }

    // ---- Admin take-over (UX-3 pre-work) -----------------------------------

    @Test
    void takeOverItem_admin_reassignsReviewerAndPreservesState() throws Exception {
        var ctx = seedInReviewRequest(teamA, soTeamA);

        // soTeamA has in-flight review state that must survive the take-over.
        EstimateRequestItem item = itemRepository.findById(ctx.itemId).orElseThrow();
        item.setComplexity(Complexity.MED);
        item.setJustification("Half-done review state");
        itemRepository.save(item);

        mvc.perform(post(adminItemUrl(ctx.requestId, ctx.itemId, "take-over"))
                .with(user(admin)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("IN_REVIEW"))
            .andExpect(jsonPath("$.items[0].reviewerStatus").value("you"))
            .andExpect(jsonPath("$.items[0].complexity").value("MED"))
            .andExpect(jsonPath("$.items[0].justification").value("Half-done review state"));

        EstimateRequestItem after = itemRepository.findById(ctx.itemId).orElseThrow();
        assertThat(after.getReviewerId())
            .isEqualTo(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow().getId());

        var takeOverRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(EstimateRequest.ENTITY_TYPE, ctx.requestId)
            .stream().filter(r -> r.getAction() == ChangeAction.ITEM_REVIEW_TAKEN_OVER).toList();
        assertThat(takeOverRows).hasSize(1);
        assertThat(takeOverRows.get(0).getNotes()).contains("from");
    }

    @Test
    void takeOverItem_nonAdmin_returns403() throws Exception {
        var ctx = seedInReviewRequest(teamA, soTeamA);

        mvc.perform(post(adminItemUrl(ctx.requestId, ctx.itemId, "take-over"))
                .with(user(soTeamB)).with(csrf()))
            .andExpect(status().isForbidden());

        // Claim unchanged
        assertThat(itemRepository.findById(ctx.itemId).orElseThrow().getReviewerId())
            .isEqualTo(userRepository.findByEmailIgnoreCase(soTeamA.getUsername()).orElseThrow().getId());
    }

    @Test
    void takeOverItem_submittedItem_returns409InvalidState() throws Exception {
        var ctx = seedSubmittedRequest(teamA);

        mvc.perform(post(adminItemUrl(ctx.requestId, ctx.itemId, "take-over"))
                .with(user(admin)).with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    @Test
    void takeOverItem_ownClaim_isNoOp() throws Exception {
        // Admin claims via the normal start (bypasses team check), then
        // take-over on their own claim succeeds without a second audit row.
        var ctx = seedInReviewRequest(teamA, admin);

        mvc.perform(post(adminItemUrl(ctx.requestId, ctx.itemId, "take-over"))
                .with(user(admin)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].reviewerStatus").value("you"));

        long takeOverRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(EstimateRequest.ENTITY_TYPE, ctx.requestId)
            .stream().filter(r -> r.getAction() == ChangeAction.ITEM_REVIEW_TAKEN_OVER).count();
        assertThat(takeOverRows).isZero();
    }

    // ---- Team workload reporting (UX-3 rebuild) -----------------------------

    @Test
    void teamWorkload_aggregatesApprovedItems() throws Exception {
        var ctx = seedInReviewRequest(teamA, soTeamA);

        // Approve at LOW: template line is ons 5 / off 2; rate 125/45 →
        // cost = 5*125 + 2*45 = 715.
        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "approve")).with(user(soTeamA)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "LOW", "justification", "ok"))))
            .andExpect(status().isOk());

        String body = mvc.perform(get("/api/reports/team-workload").with(user(admin)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        JsonNode rowA = null;
        for (JsonNode r : json.readTree(body)) {
            if (r.get("teamId").asLong() == teamA.getId()) rowA = r;
        }
        assertThat(rowA).isNotNull();
        assertThat(rowA.get("totalEstimateRequests").asLong()).isEqualTo(1);
        assertThat(rowA.get("approvedCount").asLong()).isEqualTo(1);
        assertThat(rowA.get("submittedCount").asLong()).isZero();
        assertThat(new BigDecimal(rowA.get("totalApprovedOnshoreHours").asText()))
            .isEqualByComparingTo("5");
        assertThat(new BigDecimal(rowA.get("totalApprovedOffshoreHours").asText()))
            .isEqualByComparingTo("2");
        assertThat(new BigDecimal(rowA.get("totalApprovedCost").asText()))
            .isEqualByComparingTo("715.00");

        // Detail lists the approved item with its request context.
        mvc.perform(get("/api/reports/team-workload/" + teamA.getId()).with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.recentApprovedEstimates.length()").value(1))
            .andExpect(jsonPath("$.recentApprovedEstimates[0].complexity").value("LOW"))
            .andExpect(jsonPath("$.recentApprovedEstimates[0].productName").isNotEmpty());
    }

    @Test
    void teamWorkload_submittedItemsCountWithoutMetrics() throws Exception {
        var ctx = seedSubmittedRequest(teamA);

        String body = mvc.perform(get("/api/reports/team-workload").with(user(admin)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        JsonNode rowA = null;
        for (JsonNode r : json.readTree(body)) {
            if (r.get("teamId").asLong() == teamA.getId()) rowA = r;
        }
        assertThat(rowA).isNotNull();
        assertThat(rowA.get("submittedCount").asLong()).isEqualTo(1);
        assertThat(rowA.get("approvedCount").asLong()).isZero();
        assertThat(new BigDecimal(rowA.get("totalApprovedCost").asText())).isZero();
        // ctx used only for seeding — reference it so the linter is happy.
        assertThat(ctx.requestId).isNotNull();
    }

    // ---- Revenue Manager review-action gate (SEC-5) ------------------------

    @Test
    void revenueManager_canReadQueue_butCannotActOnItems() throws Exception {
        var ctx = seedSubmittedRequest(teamA);

        // Reads stay open — RM needs review visibility for pricing.
        mvc.perform(get("/api/estimates/review").with(user(revenueManager)))
            .andExpect(status().isOk());

        // …but every mutating review action is 403 for RM (method-level gate),
        // even on a team-unassigned-style path the service check would wave through.
        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "start"))
                .with(user(revenueManager)).with(csrf()))
            .andExpect(status().isForbidden());
        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "approve"))
                .with(user(revenueManager)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "LOW", "justification", "x"))))
            .andExpect(status().isForbidden());
        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "reject"))
                .with(user(revenueManager)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rejectionReason", "x"))))
            .andExpect(status().isForbidden());
        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "request-clarification"))
                .with(user(revenueManager)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("clarificationNote", "x"))))
            .andExpect(status().isForbidden());
    }

    private String adminItemUrl(Long requestId, Long itemId, String action) {
        return "/api/estimates/admin/" + requestId + "/items/" + itemId + "/" + action;
    }

    // ---- M4: team-scoped review queue + isReviewable -----------------------

    @Test
    void reviewQueue_soOnTeamA_seesOnlyTeamARequests() throws Exception {
        SdlcPhase phase = seedPhase("Queue Phase", 1);
        Product pA = seedProductWithTeam("Queue Product A", teamA);
        Product pB = seedProductWithTeam("Queue Product B", teamB);
        seedActiveTemplateWithLine(pA.getId(), null, phase.getId());
        seedActiveTemplateWithLine(pB.getId(), null, phase.getId());

        Long reqA = createAndSubmitRequest("Request Team A", pA.getId());
        Long reqB = createAndSubmitRequest("Request Team B", pB.getId());

        // soTeamA sees reqA, not reqB
        String bodyA = mvc.perform(get("/api/estimates/review").with(user(soTeamA)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(bodyA).contains("\"id\":" + reqA);
        assertThat(bodyA).doesNotContain("\"id\":" + reqB);

        // soTeamB sees reqB, not reqA
        String bodyB = mvc.perform(get("/api/estimates/review").with(user(soTeamB)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(bodyB).contains("\"id\":" + reqB);
        assertThat(bodyB).doesNotContain("\"id\":" + reqA);
    }

    @Test
    void reviewQueue_soWithNoTeams_seesOnlyNoTeamProducts() throws Exception {
        SdlcPhase phase = seedPhase("NoTeam Queue Phase", 1);
        Product pTeamed = seedProductWithTeam("Teamed Product", teamA);
        Product pFree = seedProductNoTeam("Free Product");
        seedActiveTemplateWithLine(pTeamed.getId(), null, phase.getId());
        seedActiveTemplateWithLine(pFree.getId(), null, phase.getId());

        Long reqTeamed = createAndSubmitRequest("Teamed Request", pTeamed.getId());
        Long reqFree = createAndSubmitRequest("Free Request", pFree.getId());

        String body = mvc.perform(get("/api/estimates/review").with(user(soNoTeam)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        // No-team SO sees the free product request (permissive), not the teamed one
        assertThat(body).contains("\"id\":" + reqFree);
        assertThat(body).doesNotContain("\"id\":" + reqTeamed);
    }

    @Test
    void getForReview_annotatesIsReviewableBasedOnTeam() throws Exception {
        SdlcPhase phase = seedPhase("Reviewable Phase", 1);
        Product pA = seedProductWithTeam("Reviewable Product", teamA);
        seedActiveTemplateWithLine(pA.getId(), null, phase.getId());
        Long reqId = createAndSubmitRequest("Reviewable Request", pA.getId());

        // soTeamA: item is SUBMITTED on their team → isReviewable = true
        mvc.perform(get("/api/estimates/review/" + reqId).with(user(soTeamA)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].isReviewable").value(true));

        // soTeamB: different team → isReviewable = false
        mvc.perform(get("/api/estimates/review/" + reqId).with(user(soTeamB)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].isReviewable").value(false));
    }

    // ---- helpers ------------------------------------------------------------

    private record RequestCtx(Long requestId, Long itemId) {}

    private RequestCtx seedSubmittedRequest(Team team) throws Exception {
        SdlcPhase phase = seedPhase("Review Phase", 1);
        Product product = seedProductWithTeam("TeamProduct", team);
        seedActiveTemplateWithLine(product.getId(), null, phase.getId());
        Long reqId = createAndSubmitRequest("Team Request", product.getId());
        return new RequestCtx(reqId, firstItemId(reqId));
    }

    private RequestCtx seedSubmittedRequestNoTeam() throws Exception {
        SdlcPhase phase = seedPhase("NoTeam Phase", 1);
        Product product = seedProductNoTeam("Unassigned Product");
        seedActiveTemplateWithLine(product.getId(), null, phase.getId());
        Long reqId = createAndSubmitRequest("No Team Request", product.getId());
        return new RequestCtx(reqId, firstItemId(reqId));
    }

    private RequestCtx seedInReviewRequest(Team team, AppUserDetails reviewer) throws Exception {
        var ctx = seedSubmittedRequest(team);
        mvc.perform(post(itemUrl(ctx.requestId, ctx.itemId, "start"))
                .with(user(reviewer)).with(csrf()))
            .andExpect(status().isOk());
        return ctx;
    }

    private Long createAndSubmitRequest(String title, Long productId) throws Exception {
        var bodyMap = new java.util.HashMap<String, Object>();
        bodyMap.put("title", title);
        bodyMap.put("categoryId", 1);
        bodyMap.put("programTypeIds", List.of(1));
        bodyMap.put("clientId", 1);
        bodyMap.put("programId", 1);
        bodyMap.put("items", List.of(Map.of("productId", productId)));
        String body = json.writeValueAsString(bodyMap);
        String resp = mvc.perform(post("/api/estimates/my")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        Long id = ((Number) json.readValue(resp, Map.class).get("id")).longValue();
        mvc.perform(post("/api/estimates/my/" + id + "/submit")
                .with(user(requester)).with(csrf()))
            .andExpect(status().isOk());
        return id;
    }

    private Long firstItemId(Long requestId) {
        return itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(requestId)
            .get(0).getId();
    }

    private String itemUrl(Long requestId, Long itemId, String action) {
        return "/api/estimates/review/" + requestId + "/items/" + itemId + "/" + action;
    }

    private Team createTeam(String name) {
        Team t = new Team();
        t.setName(name);
        t.setActive(true);
        t.setCreatedBy(1L);
        t.setUpdatedBy(1L);
        return teamRepository.save(t);
    }

    private Product seedProductWithTeam(String name, Team team) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setTeam(team);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private Product seedProductNoTeam(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
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

    private void seedActiveTemplateWithLine(Long productId, Long subFeatureId, Long phaseId) {
        EstimateTemplate t = new EstimateTemplate();
        t.setProductId(productId);
        t.setSubFeatureId(subFeatureId);
        t.setVersionNumber(1);
        t.setActive(true);
        t.setCreatedBy(1L);
        templateRepository.save(t);

        EstimateTemplateLine l = new EstimateTemplateLine();
        l.setTemplateId(t.getId());
        l.setSdlcPhaseId(phaseId);
        l.setOnshoreLow(BigDecimal.valueOf(5));
        l.setOnshoreMed(BigDecimal.valueOf(10));
        l.setOnshoreHigh(BigDecimal.valueOf(15));
        l.setOffshoreLow(BigDecimal.valueOf(2));
        l.setOffshoreMed(BigDecimal.valueOf(4));
        l.setOffshoreHigh(BigDecimal.valueOf(6));
        templateLineRepository.save(l);
    }

    private User ensureUserWithRole(String email, String first, String last, short roleId) {
        return userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            Role role = em.find(Role.class, roleId);
            if (role == null) throw new IllegalStateException("Role " + roleId + " missing");
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
