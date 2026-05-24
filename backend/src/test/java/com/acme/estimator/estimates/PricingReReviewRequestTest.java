package com.acme.estimator.estimates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
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
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateLine;
import com.acme.estimator.catalog.templates.EstimateTemplateLineRepository;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
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
 * Security and state-machine tests for the requester-initiated pricing re-review endpoint.
 *
 * <p>Covers: owner success, non-owner 404, REVENUE_MANAGER-only 403, not-all-approved 409,
 * already-PENDING 409, admin override success, and context length validation.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PricingReReviewRequestTest {

    private static final String BASE = "/api/estimates/my";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EstimateRequestRepository requestRepository;
    @Autowired private EstimateRequestItemRepository itemRepository;
    @Autowired private EstimateRequestPhaseLineRepository phaseLineRepository;
    @Autowired private EstimateRequestQuestionAnswerRepository answerRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private EstimateTemplateRepository templateRepository;
    @Autowired private EstimateTemplateLineRepository templateLineRepository;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;
    @PersistenceContext private EntityManager em;

    private AppUserDetails requester;
    private AppUserDetails otherRequester;
    private AppUserDetails rm;
    private AppUserDetails so;
    private AppUserDetails admin;

    private Long productId;
    private Long phaseId;

    @BeforeEach
    void setUp() {
        cleanAll();

        requester      = new AppUserDetails(ensureUser("req-pricing@local",       "Req",   "Owner",  (short) 4));
        otherRequester = new AppUserDetails(ensureUser("req-pricing-other@local", "Other", "Req",    (short) 4));
        rm             = new AppUserDetails(ensureUser("rm-pricing@local",        "Rev",   "Mgr",    (short) 5));
        so             = new AppUserDetails(ensureUser("so-pricing@local",        "SO",    "Pricing",(short) 2));
        admin          = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());

        SdlcPhase phase = new SdlcPhase();
        phase.setName("Pricing Phase");
        phase.setDisplayOrder(1);
        phase.setActive(true);
        phase.setSystem(false);
        phase.setCreatedBy(1L);
        phase.setUpdatedBy(1L);
        phaseId = phaseRepository.save(phase).getId();

        Product p = new Product();
        p.setName("Pricing Product");
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        productId = productRepository.save(p).getId();

        EstimateTemplate t = new EstimateTemplate();
        t.setProductId(productId);
        t.setVersionNumber(1);
        t.setActive(true);
        t.setCreatedBy(1L);
        templateRepository.save(t);

        EstimateTemplateLine l = new EstimateTemplateLine();
        l.setTemplateId(t.getId());
        l.setSdlcPhaseId(phaseId);
        l.setOnshoreLow(BigDecimal.valueOf(4));
        l.setOnshoreMed(BigDecimal.valueOf(8));
        l.setOnshoreHigh(BigDecimal.valueOf(12));
        l.setOffshoreLow(BigDecimal.valueOf(2));
        l.setOffshoreMed(BigDecimal.valueOf(4));
        l.setOffshoreHigh(BigDecimal.valueOf(6));
        templateLineRepository.save(l);
    }

    @AfterEach
    void tearDown() {
        cleanAll();
        for (String email : List.of(
            "req-pricing@local", "req-pricing-other@local", "rm-pricing@local", "so-pricing@local"
        )) {
            userRepository.findByEmailIgnoreCase(email).ifPresent(userRepository::delete);
        }
    }

    private void cleanAll() {
        phaseLineRepository.deleteAll();
        answerRepository.deleteAll();
        itemRepository.deleteAll();
        requestRepository.deleteAll();
        templateLineRepository.deleteAll();
        templateRepository.deleteAll();
        productRepository.deleteAll();
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    void requestPricingReview_ownerWithAllApproved_succeedsAndAudits() throws Exception {
        Long reqId = createApprovedRequest();

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", "Please review the margin."))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pricingReviewStatus").value("PENDING"));

        long auditCount = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(EstimateRequest.ENTITY_TYPE, reqId)
            .stream().filter(r -> r.getAction() == ChangeAction.PRICING_REVIEW_REQUESTED).count();
        assertThat(auditCount).isEqualTo(1);
    }

    @Test
    void requestPricingReview_nonOwnerRequester_returns404() throws Exception {
        Long reqId = createApprovedRequest();

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(otherRequester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", "Should not work"))))
            .andExpect(status().isNotFound());
    }

    @Test
    void requestPricingReview_revenueManagerOnly_returns403() throws Exception {
        Long reqId = createApprovedRequest();

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(rm)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", "RM trying to queue"))))
            .andExpect(status().isForbidden());
    }

    @Test
    void requestPricingReview_notAllApproved_returns409() throws Exception {
        Long reqId = createSubmittedRequest();

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", "Items not approved yet"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    @Test
    void requestPricingReview_alreadyPending_returns409() throws Exception {
        Long reqId = createApprovedRequest();
        jdbc.update("UPDATE estimate_requests SET pricing_review_status = 'PENDING' WHERE id = ?", reqId);

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", "Already queued"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    @Test
    void requestPricingReview_adminOnOtherUserRequest_succeeds() throws Exception {
        Long reqId = createApprovedRequest();

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", "Admin queuing on behalf of requester"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pricingReviewStatus").value("PENDING"));
    }

    @Test
    void requestPricingReview_contextTooLong_returns400() throws Exception {
        Long reqId = createApprovedRequest();
        String longContext = "x".repeat(4001);

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", longContext))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void requestPricingReview_contextAtMaxLength_succeeds() throws Exception {
        Long reqId = createApprovedRequest();
        String maxContext = "x".repeat(4000);

        mvc.perform(post(BASE + "/" + reqId + "/request-pricing-review")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("context", maxContext))))
            .andExpect(status().isOk());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Long createApprovedRequest() throws Exception {
        Long reqId = createAndSubmitRequest();
        Long itemId = firstItemId(reqId);

        mvc.perform(post("/api/estimates/review/" + reqId + "/items/" + itemId + "/start")
                .with(user(so)).with(csrf()))
            .andExpect(status().isOk());

        mvc.perform(post("/api/estimates/review/" + reqId + "/items/" + itemId + "/approve")
                .with(user(so)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("complexity", "LOW"))))
            .andExpect(status().isOk());

        return reqId;
    }

    private Long createSubmittedRequest() throws Exception {
        Long reqId = createAndSubmitRequest();
        return reqId;
    }

    private Long createAndSubmitRequest() throws Exception {
        var body = new java.util.HashMap<String, Object>();
        body.put("title", "Pricing Re-Review Test");
        body.put("categoryId", 1);
        body.put("programTypeIds", List.of(1));
        body.put("clientId", 1);
        body.put("programId", 1);
        body.put("items", List.of(Map.of("productId", productId)));

        String resp = mvc.perform(post(BASE)
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        Long id = ((Number) json.readValue(resp, Map.class).get("id")).longValue();

        mvc.perform(post(BASE + "/" + id + "/submit")
                .with(user(requester)).with(csrf()))
            .andExpect(status().isOk());

        return id;
    }

    private Long firstItemId(Long requestId) {
        return itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(requestId)
            .get(0).getId();
    }

    private User ensureUser(String email, String first, String last, short roleId) {
        return userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            Role role = em.find(Role.class, roleId);
            if (role == null) throw new IllegalStateException("Role " + roleId + " not found");
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
