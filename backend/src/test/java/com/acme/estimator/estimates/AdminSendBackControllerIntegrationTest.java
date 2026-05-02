package com.acme.estimator.estimates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
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
 * Admin-only send-back path. Covers:
 * <ul>
 *   <li>Admin sends Approved → Submitted, fields cleared (incl. overrides)</li>
 *   <li>Admin sends Rejected → Submitted</li>
 *   <li>Admin send-back on Submitted → 409 INVALID_STATE</li>
 *   <li>SO calling send-back → 403 (role gate)</li>
 *   <li>Send-back without reason → 400</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class AdminSendBackControllerIntegrationTest {

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

    private AppUserDetails admin;
    private AppUserDetails so;
    private AppUserDetails requester;
    private Long seededRateId;

    @BeforeEach
    void setUp() {
        cleanAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        so = new AppUserDetails(ensureUserWithRole("so-sendback-test@local", "SO", "Sender", (short) 2));
        requester = new AppUserDetails(ensureUserWithRole("req-sendback-test@local", "Req", "User", (short) 4));

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
        for (String email : List.of("so-sendback-test@local", "req-sendback-test@local")) {
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

    @Test
    void adminSendBack_onApproved_returnsToSubmittedAndClearsReviewState() throws Exception {
        Long approvedId = seedApprovedRequest();
        // Confirm pre-state.
        var pre = requestRepository.findById(approvedId).orElseThrow();
        assertThat(pre.getStatus()).isEqualTo(EstimateStatus.APPROVED);
        assertThat(pre.getComplexity()).isNotNull();
        assertThat(pre.getJustification()).isNotBlank();
        assertThat(pre.getApprovedBlendedRateId()).isNotNull();

        // Also stamp an override to confirm send-back clears it.
        var lines = phaseLineRepository
            .findAllByEstimateRequestIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(approvedId);
        lines.get(0).setOnshoreOverride(new BigDecimal("99.00"));
        phaseLineRepository.saveAll(lines);

        mvc.perform(asAdmin(post("/api/estimates/admin/" + approvedId + "/send-back"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", "Approved in error — needs re-look"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"))
            .andExpect(jsonPath("$.reviewerId").doesNotExist())
            .andExpect(jsonPath("$.complexity").doesNotExist())
            .andExpect(jsonPath("$.justification").doesNotExist())
            .andExpect(jsonPath("$.approvedBlendedRateId").doesNotExist());

        // Override cleared too — the snapshot vs review-state distinction.
        var afterLines = phaseLineRepository
            .findAllByEstimateRequestIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(approvedId);
        assertThat(afterLines.get(0).getOnshoreOverride()).isNull();

        long sentBackRows = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, approvedId
        ).stream().filter(r -> r.getAction() == ChangeAction.SENT_BACK).count();
        assertThat(sentBackRows).isEqualTo(1);
    }

    @Test
    void adminSendBack_onRejected_returnsToSubmitted() throws Exception {
        Long rejectedId = seedRejectedRequest();

        mvc.perform(asAdmin(post("/api/estimates/admin/" + rejectedId + "/send-back"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", "Reconsider"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUBMITTED"));
    }

    @Test
    void adminSendBack_onSubmitted_returns409() throws Exception {
        Long submittedId = seedSubmittedRequest();

        mvc.perform(asAdmin(post("/api/estimates/admin/" + submittedId + "/send-back"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", "Whoops"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    @Test
    void soCallingSendBack_returns403() throws Exception {
        Long approvedId = seedApprovedRequest();
        mvc.perform(post("/api/estimates/admin/" + approvedId + "/send-back")
                .with(user(so)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", "Should be denied"))))
            .andExpect(status().isForbidden());
    }

    @Test
    void sendBackWithoutReason_returns400() throws Exception {
        Long approvedId = seedApprovedRequest();
        mvc.perform(asAdmin(post("/api/estimates/admin/" + approvedId + "/send-back"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", ""))))
            .andExpect(status().isBadRequest());
    }

    // ---- helpers -----------------------------------------------------------

    private Long seedSubmittedRequest() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("P");
        EstimateTemplate template = seedActiveTemplate(product.getId(), 1);
        seedTemplateLine(template.getId(), phase.getId(), 5, 10, 15, 2, 4, 6);
        Long draftId = createDraft("Test", product.getId());
        mvc.perform(post("/api/estimates/my/" + draftId + "/submit")
                .with(user(requester)).with(csrf()))
            .andExpect(status().isOk());
        return draftId;
    }

    private Long seedApprovedRequest() throws Exception {
        Long submittedId = seedSubmittedRequest();
        mvc.perform(post("/api/estimates/review/" + submittedId + "/start")
                .with(user(so)).with(csrf()))
            .andExpect(status().isOk());
        mvc.perform(put("/api/estimates/review/" + submittedId + "/state")
                .with(user(so)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "complexity", "MED",
                    "justification", "Looks reasonable"
                ))))
            .andExpect(status().isOk());
        mvc.perform(post("/api/estimates/review/" + submittedId + "/approve")
                .with(user(so)).with(csrf()))
            .andExpect(status().isOk());
        return submittedId;
    }

    private Long seedRejectedRequest() throws Exception {
        Long submittedId = seedSubmittedRequest();
        mvc.perform(post("/api/estimates/review/" + submittedId + "/start")
                .with(user(so)).with(csrf()))
            .andExpect(status().isOk());
        mvc.perform(post("/api/estimates/review/" + submittedId + "/reject")
                .with(user(so)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("justification", "Insufficient detail"))))
            .andExpect(status().isOk());
        return submittedId;
    }

    private Long createDraft(String title, Long productId) throws Exception {
        String body = json.writeValueAsString(Map.of("title", title, "productId", productId));
        String resp = mvc.perform(post("/api/estimates/my")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return ((Number) json.readValue(resp, Map.class).get("id")).longValue();
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

    private EstimateTemplate seedActiveTemplate(Long productId, int versionNumber) {
        EstimateTemplate t = new EstimateTemplate();
        t.setProductId(productId);
        t.setSubFeatureId(null);
        t.setVersionNumber(versionNumber);
        t.setActive(true);
        t.setCreatedBy(1L);
        return templateRepository.save(t);
    }

    private void seedTemplateLine(Long templateId, Long phaseId,
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

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder b) {
        return b.with(user(admin)).with(csrf());
    }
}
