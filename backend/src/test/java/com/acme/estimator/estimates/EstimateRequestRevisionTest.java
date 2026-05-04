package com.acme.estimator.estimates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

/**
 * Phase 9b M3 — revision, resubmit, drop, and admin per-item send-back.
 *
 * <p>Covers:
 * <ul>
 *   <li>revise-and-resubmit: REJECTED item returns to SUBMITTED, revisionCount incremented</li>
 *   <li>product swap: originalProductId set on first swap, unchanged on subsequent swaps</li>
 *   <li>revise-and-resubmit on non-REJECTED item → 409</li>
 *   <li>revise-and-resubmit by non-owner → 404</li>
 *   <li>drop: REJECTED item deleted, request still exists</li>
 *   <li>drop last item → 409 CANNOT_DROP_LAST_ITEM</li>
 *   <li>drop non-REJECTED item → 409 INVALID_STATE</li>
 *   <li>admin send-back: APPROVED item → SUBMITTED, overrides cleared</li>
 *   <li>admin send-back on REJECTED item → 409 (requester handles REJECTED via revise/drop)</li>
 *   <li>send-back without reason → 400</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EstimateRequestRevisionTest {

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

    private AppUserDetails admin;
    private AppUserDetails so;
    private AppUserDetails requester;
    private AppUserDetails otherRequester;
    private Long seededRateId;

    @BeforeEach
    void setUp() {
        cleanAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        so = new AppUserDetails(ensureUser("so-rev-test@local", "SO", "Rev", (short) 2));
        requester = new AppUserDetails(ensureUser("req-rev-test@local", "Req", "Rev", (short) 4));
        otherRequester = new AppUserDetails(ensureUser("other-rev-test@local", "Other", "Rev", (short) 4));

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
        for (String e : List.of("so-rev-test@local", "req-rev-test@local", "other-rev-test@local")) {
            userRepository.findByEmailIgnoreCase(e).ifPresent(userRepository::delete);
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

    // ---- revise-and-resubmit -----------------------------------------------

    @Test
    void reviseAndResubmit_onRejectedItem_returnsToSubmittedAndIncrementsRevisionCount()
        throws Exception {
        RejectedCtx ctx = seedRejectedRequest();

        mvc.perform(post("/api/estimates/my/" + ctx.requestId()
                    + "/items/" + ctx.itemId() + "/revise-and-resubmit")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("SUBMITTED"))
            .andExpect(jsonPath("$.items[0].revisionCount").value(1))
            .andExpect(jsonPath("$.items[0].rejectionReason").doesNotExist())
            .andExpect(jsonPath("$.items[0].complexity").doesNotExist())
            .andExpect(jsonPath("$.items[0].reviewerId").doesNotExist());

        // Audit: ITEM_REVISED + ITEM_RESUBMITTED
        var log = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, ctx.requestId());
        long revisedCount = log.stream().filter(r -> r.getAction() == ChangeAction.ITEM_REVISED).count();
        long resubmittedCount = log.stream().filter(r -> r.getAction() == ChangeAction.ITEM_RESUBMITTED).count();
        assertThat(revisedCount).isEqualTo(1);
        assertThat(resubmittedCount).isEqualTo(1);
    }

    @Test
    void reviseAndResubmit_withProductSwap_setsOriginalProductId() throws Exception {
        SdlcPhase phase = seedPhase("Dev", 1);
        Product productA = seedAtomicProduct("Product A");
        Product productB = seedAtomicProduct("Product B");
        seedTemplateWithLine(productA.getId(), phase.getId());
        seedTemplateWithLine(productB.getId(), phase.getId());

        Long requestId = createDraft("Swap Test", productA.getId());
        submitRequest(requestId);
        Long itemId = firstItemId(requestId);
        startReview(requestId, itemId);
        rejectItem(requestId, itemId);

        // Swap to Product B on first revision
        mvc.perform(post("/api/estimates/my/" + requestId
                    + "/items/" + itemId + "/revise-and-resubmit")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("productId", productB.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].productId").value(productB.getId()))
            .andExpect(jsonPath("$.items[0].originalProductId").value(productA.getId()));

        // Confirm DB state
        EstimateRequestItem item = itemRepository.findById(itemId).orElseThrow();
        assertThat(item.getProductId()).isEqualTo(productB.getId());
        assertThat(item.getOriginalProductId()).isEqualTo(productA.getId());
    }

    @Test
    void reviseAndResubmit_secondSwap_doesNotChangeOriginalProductId() throws Exception {
        SdlcPhase phase = seedPhase("Dev", 1);
        Product productA = seedAtomicProduct("Product A2");
        Product productB = seedAtomicProduct("Product B2");
        Product productC = seedAtomicProduct("Product C2");
        seedTemplateWithLine(productA.getId(), phase.getId());
        seedTemplateWithLine(productB.getId(), phase.getId());
        seedTemplateWithLine(productC.getId(), phase.getId());

        Long requestId = createDraft("Two-Swap Test", productA.getId());
        submitRequest(requestId);
        Long itemId = firstItemId(requestId);

        // First rejection + swap to B
        startReview(requestId, itemId);
        rejectItem(requestId, itemId);
        mvc.perform(post("/api/estimates/my/" + requestId
                    + "/items/" + itemId + "/revise-and-resubmit")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("productId", productB.getId()))))
            .andExpect(status().isOk());

        // Second rejection + swap to C
        startReview(requestId, itemId);
        rejectItem(requestId, itemId);
        mvc.perform(post("/api/estimates/my/" + requestId
                    + "/items/" + itemId + "/revise-and-resubmit")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("productId", productC.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].productId").value(productC.getId()))
            .andExpect(jsonPath("$.items[0].originalProductId").value(productA.getId()))
            .andExpect(jsonPath("$.items[0].revisionCount").value(2));
    }

    @Test
    void reviseAndResubmit_onSubmittedItem_returns409() throws Exception {
        Long submittedId = seedSubmittedRequest();
        Long itemId = firstItemId(submittedId);

        mvc.perform(post("/api/estimates/my/" + submittedId
                    + "/items/" + itemId + "/revise-and-resubmit")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    @Test
    void reviseAndResubmit_byNonOwner_returns404() throws Exception {
        RejectedCtx ctx = seedRejectedRequest();

        mvc.perform(post("/api/estimates/my/" + ctx.requestId()
                    + "/items/" + ctx.itemId() + "/revise-and-resubmit")
                .with(user(otherRequester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of())))
            .andExpect(status().isNotFound());
    }

    // ---- drop --------------------------------------------------------------

    @Test
    void dropItem_onRejectedItem_removesItemAndReturnsUpdatedRequest() throws Exception {
        // Create request with two items so we can drop one
        SdlcPhase phase = seedPhase("Drop Phase", 1);
        Product p1 = seedAtomicProduct("Drop P1");
        Product p2 = seedAtomicProduct("Drop P2");
        seedTemplateWithLine(p1.getId(), phase.getId());
        seedTemplateWithLine(p2.getId(), phase.getId());

        String body = json.writeValueAsString(Map.of(
            "title", "Drop Test",
            "items", List.of(Map.of("productId", p1.getId()), Map.of("productId", p2.getId()))
        ));
        String resp = mvc.perform(post("/api/estimates/my")
                .with(user(requester)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        Long requestId = ((Number) json.readValue(resp, Map.class).get("id")).longValue();

        submitRequest(requestId);
        Long item1Id = itemRepository.findByEstimateRequestIdOrderByDisplayOrderAsc(requestId)
            .get(0).getId();
        Long item2Id = itemRepository.findByEstimateRequestIdOrderByDisplayOrderAsc(requestId)
            .get(1).getId();

        startReview(requestId, item1Id);
        rejectItem(requestId, item1Id);

        mvc.perform(delete("/api/estimates/my/" + requestId + "/items/" + item1Id)
                .with(user(requester)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].productId").value(p2.getId()));

        // Item gone from DB
        assertThat(itemRepository.findById(item1Id)).isEmpty();
        // Phase lines cleaned up
        assertThat(phaseLineRepository
            .findAllByItemIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(item1Id)).isEmpty();

        // Audit
        long droppedCount = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, requestId
        ).stream().filter(r -> r.getAction() == ChangeAction.ITEM_DROPPED).count();
        assertThat(droppedCount).isEqualTo(1);
    }

    @Test
    void dropItem_lastItem_returns409() throws Exception {
        RejectedCtx ctx = seedRejectedRequest();

        mvc.perform(delete("/api/estimates/my/" + ctx.requestId() + "/items/" + ctx.itemId())
                .with(user(requester)).with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("CANNOT_DROP_LAST_ITEM"));
    }

    @Test
    void dropItem_onSubmittedItem_returns409() throws Exception {
        Long submittedId = seedSubmittedRequest();
        Long itemId = firstItemId(submittedId);

        mvc.perform(delete("/api/estimates/my/" + submittedId + "/items/" + itemId)
                .with(user(requester)).with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    // ---- admin send-back per item ------------------------------------------

    @Test
    void adminSendBackItem_onApprovedItem_returnsToSubmittedAndClearsState() throws Exception {
        RejectedCtx ctx = seedApprovedRequest();

        EstimateRequestItem pre = itemRepository.findById(ctx.itemId()).orElseThrow();
        assertThat(pre.getStatus()).isEqualTo(EstimateStatus.APPROVED);

        // Stamp an override
        var lines = phaseLineRepository
            .findAllByItemIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(ctx.itemId());
        lines.get(0).setOnshoreOverride(new BigDecimal("77.00"));
        phaseLineRepository.saveAll(lines);

        mvc.perform(post("/api/estimates/admin/" + ctx.requestId()
                    + "/items/" + ctx.itemId() + "/send-back")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", "Needs another look"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].status").value("SUBMITTED"))
            .andExpect(jsonPath("$.items[0].complexity").doesNotExist())
            .andExpect(jsonPath("$.items[0].approvedBlendedRateId").doesNotExist());

        // Override cleared
        var afterLines = phaseLineRepository
            .findAllByItemIdOrderBySdlcPhaseDisplayOrderSnapshotAsc(ctx.itemId());
        assertThat(afterLines.get(0).getOnshoreOverride()).isNull();

        long sentBack = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            EstimateRequest.ENTITY_TYPE, ctx.requestId()
        ).stream().filter(r -> r.getAction() == ChangeAction.ITEM_SENT_BACK).count();
        assertThat(sentBack).isEqualTo(1);
    }

    @Test
    void adminSendBackItem_onRejectedItem_returns409() throws Exception {
        RejectedCtx ctx = seedRejectedRequest();

        mvc.perform(post("/api/estimates/admin/" + ctx.requestId()
                    + "/items/" + ctx.itemId() + "/send-back")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", "Re-check"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_STATE"));
    }

    @Test
    void adminSendBackItem_withoutReason_returns400() throws Exception {
        RejectedCtx ctx = seedApprovedRequest();

        mvc.perform(post("/api/estimates/admin/" + ctx.requestId()
                    + "/items/" + ctx.itemId() + "/send-back")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("reason", ""))))
            .andExpect(status().isBadRequest());
    }

    // ---- seed helpers ------------------------------------------------------

    private record RejectedCtx(Long requestId, Long itemId) {}

    private Long seedSubmittedRequest() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Rev-P");
        seedTemplateWithLine(product.getId(), phase.getId());
        Long draftId = createDraft("Rev Test", product.getId());
        submitRequest(draftId);
        return draftId;
    }

    private RejectedCtx seedRejectedRequest() throws Exception {
        Long submittedId = seedSubmittedRequest();
        Long itemId = firstItemId(submittedId);
        startReview(submittedId, itemId);
        rejectItem(submittedId, itemId);
        return new RejectedCtx(submittedId, itemId);
    }

    private RejectedCtx seedApprovedRequest() throws Exception {
        Long submittedId = seedSubmittedRequest();
        Long itemId = firstItemId(submittedId);
        startReview(submittedId, itemId);
        mvc.perform(post("/api/estimates/review/" + submittedId
                    + "/items/" + itemId + "/approve")
                .with(user(so)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "complexity", "MED",
                    "justification", "Looks good"
                ))))
            .andExpect(status().isOk());
        return new RejectedCtx(submittedId, itemId);
    }

    private void startReview(Long requestId, Long itemId) throws Exception {
        mvc.perform(post("/api/estimates/review/" + requestId
                    + "/items/" + itemId + "/start")
                .with(user(so)).with(csrf()))
            .andExpect(status().isOk());
    }

    private void rejectItem(Long requestId, Long itemId) throws Exception {
        mvc.perform(post("/api/estimates/review/" + requestId
                    + "/items/" + itemId + "/reject")
                .with(user(so)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("rejectionReason", "Needs more detail"))))
            .andExpect(status().isOk());
    }

    private void submitRequest(Long requestId) throws Exception {
        mvc.perform(post("/api/estimates/my/" + requestId + "/submit")
                .with(user(requester)).with(csrf()))
            .andExpect(status().isOk());
    }

    private Long firstItemId(Long requestId) {
        return itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(requestId)
            .get(0).getId();
    }

    private Long createDraft(String title, Long productId) throws Exception {
        String body = json.writeValueAsString(
            Map.of("title", title, "items", List.of(Map.of("productId", productId)))
        );
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

    private void seedTemplateWithLine(Long productId, Long phaseId) {
        EstimateTemplate t = new EstimateTemplate();
        t.setProductId(productId);
        t.setVersionNumber(1);
        t.setActive(true);
        t.setCreatedBy(1L);
        EstimateTemplate saved = templateRepository.save(t);

        EstimateTemplateLine l = new EstimateTemplateLine();
        l.setTemplateId(saved.getId());
        l.setSdlcPhaseId(phaseId);
        l.setOnshoreLow(BigDecimal.valueOf(5));
        l.setOnshoreMed(BigDecimal.valueOf(10));
        l.setOnshoreHigh(BigDecimal.valueOf(15));
        l.setOffshoreLow(BigDecimal.valueOf(2));
        l.setOffshoreMed(BigDecimal.valueOf(4));
        l.setOffshoreHigh(BigDecimal.valueOf(6));
        templateLineRepository.save(l);
    }

    private User ensureUser(String email, String first, String last, short roleId) {
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
