package com.acme.estimator.catalog.questions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class CriticalQuestionControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private CriticalQuestionRepository questionRepository;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        questionRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow());
    }

    // ---- security -----------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        mvc.perform(get("/api/catalog/questions"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void solutionOwner_canList() throws Exception {
        mvc.perform(get("/api/catalog/questions").with(user(estimator)))
            .andExpect(status().isOk());
    }

    // ---- create on Product (atomic, no sub-features) -----------------------

    @Test
    void createOnAtomicProduct_succeeds_withDisplayOrder1() throws Exception {
        Product p = createProduct("Atomic", ProductMode.ATOMIC);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionText", "How many users?",
                    "required", true
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.questionText").value("How many users?"))
            .andExpect(jsonPath("$.parentType").value("Product"))
            .andExpect(jsonPath("$.required").value(true))
            .andExpect(jsonPath("$.displayOrder").value(1));

        assertThat(questionRepository.findByProductIdOrderByDisplayOrder(p.getId())).hasSize(1);
    }

    @Test
    void createOnContainerWithActiveSubFeatures_returns400_productHasSubFeatures() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        createSubFeature(p.getId(), "Variant A", true);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionText", "Won't stick"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("PRODUCT_HAS_SUB_FEATURES"));
    }

    @Test
    void createOnContainerWithOnlyInactiveSubFeatures_isAllowed() throws Exception {
        // Inactive sub-features don't trigger the rejection — the rule is
        // about ACTIVE sub-features (the ones currently in use).
        Product p = createProduct("Container", ProductMode.CONTAINER);
        createSubFeature(p.getId(), "Retired", false);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionText", "Should work"))))
            .andExpect(status().isCreated());
    }

    // ---- create on SubFeature ----------------------------------------------

    @Test
    void createOnSubFeature_succeeds_withDisplayOrder1() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        SubFeature s = createSubFeature(p.getId(), "Variant A", true);

        mvc.perform(asAdmin(post("/api/catalog/sub-features/" + s.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionText", "How big is the dataset?"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.parentType").value("SubFeature"))
            .andExpect(jsonPath("$.parentName").value("Variant A"))
            .andExpect(jsonPath("$.grandparentProductName").value("Container"))
            .andExpect(jsonPath("$.displayOrder").value(1));
    }

    @Test
    void createMultipleQuestions_displayOrderAutoIncrements() throws Exception {
        Product p = createProduct("Atomic", ProductMode.ATOMIC);

        for (int i = 1; i <= 3; i++) {
            mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionText", "Q" + i))))
                .andExpect(status().isCreated());
        }

        List<Integer> orders = questionRepository.findByProductIdOrderByDisplayOrder(p.getId())
            .stream().map(CriticalQuestion::getDisplayOrder).toList();
        assertThat(orders).containsExactly(1, 2, 3);
    }

    // ---- update --------------------------------------------------------------

    @Test
    void patch_changesText_writesUpdatedRow() throws Exception {
        Product p = createProduct("Atomic", ProductMode.ATOMIC);
        CriticalQuestion q = createQuestionForProduct(p.getId(), "Old text");

        mvc.perform(asAdmin(patch("/api/catalog/questions/" + q.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionText", "New text"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.questionText").value("New text"));

        long updates = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(CriticalQuestion.ENTITY_TYPE, q.getId())
            .stream().filter(r -> r.getAction() == ChangeAction.UPDATED && "questionText".equals(r.getFieldName()))
            .count();
        assertThat(updates).isEqualTo(1);
    }

    @Test
    void patch_doesNotAcceptParentChange() throws Exception {
        // The PATCH DTO doesn't expose productId / subFeatureId fields, so
        // an attempt to send them is silently dropped (and the question's
        // parent stays put). This test asserts the question's parent
        // doesn't change after a PATCH that includes a "productId" key.
        Product p = createProduct("Atomic", ProductMode.ATOMIC);
        Product other = createProduct("Other", ProductMode.ATOMIC);
        CriticalQuestion q = createQuestionForProduct(p.getId(), "Original");

        // Even if the client tries to smuggle parent_id, the DTO ignores it.
        mvc.perform(asAdmin(patch("/api/catalog/questions/" + q.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionText", "Edited",
                    "productId", other.getId()
                ))))
            .andExpect(status().isOk());

        CriticalQuestion reloaded = questionRepository.findById(q.getId()).orElseThrow();
        assertThat(reloaded.getProductId()).isEqualTo(p.getId());
    }

    // ---- reorder -------------------------------------------------------------

    @Test
    void reorder_writesReorderedRowsForChangedPositionsOnly() throws Exception {
        Product p = createProduct("Atomic", ProductMode.ATOMIC);
        CriticalQuestion q1 = createQuestionForProduct(p.getId(), "First");
        CriticalQuestion q2 = createQuestionForProduct(p.getId(), "Second");
        CriticalQuestion q3 = createQuestionForProduct(p.getId(), "Third");

        // Swap q1 and q3; q2 stays put.
        mvc.perform(asAdmin(patch("/api/catalog/products/" + p.getId() + "/questions/reorder"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionIds", List.of(q3.getId(), q2.getId(), q1.getId())
                ))))
            .andExpect(status().isOk());

        // q1: 1 → 3 (changed). q2: 2 → 2 (unchanged). q3: 3 → 1 (changed).
        long q1Reorders = countReorderedRows(q1.getId());
        long q2Reorders = countReorderedRows(q2.getId());
        long q3Reorders = countReorderedRows(q3.getId());
        assertThat(q1Reorders).isEqualTo(1);
        assertThat(q2Reorders).isEqualTo(0);
        assertThat(q3Reorders).isEqualTo(1);
    }

    @Test
    void reorder_withDuplicateIds_returns400() throws Exception {
        Product p = createProduct("Atomic", ProductMode.ATOMIC);
        CriticalQuestion q1 = createQuestionForProduct(p.getId(), "A");
        CriticalQuestion q2 = createQuestionForProduct(p.getId(), "B");

        mvc.perform(asAdmin(patch("/api/catalog/products/" + p.getId() + "/questions/reorder"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionIds", List.of(q1.getId(), q1.getId())
                ))))
            .andExpect(status().isBadRequest());
        // Sanity: q2 is still there with its original order.
        assertThat(questionRepository.findById(q2.getId()).orElseThrow().getDisplayOrder()).isEqualTo(2);
    }

    // ---- cross-catalog browser -------------------------------------------

    @Test
    void crossCatalog_filtersByParentType() throws Exception {
        Product atomic = createProduct("AtomicProd", ProductMode.ATOMIC);
        Product container = createProduct("ContainerProd", ProductMode.CONTAINER);
        SubFeature sub = createSubFeature(container.getId(), "VariantA", true);

        createQuestionForProduct(atomic.getId(), "Q on product");
        createQuestionForSubFeature(sub.getId(), "Q on sub-feature");

        mvc.perform(get("/api/catalog/questions")
                .with(user(admin))
                .param("parentType", "Product"))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].parentType").value("Product"));

        mvc.perform(get("/api/catalog/questions")
                .with(user(admin))
                .param("parentType", "SubFeature"))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].parentType").value("SubFeature"));
    }

    @Test
    void crossCatalog_searchByQuestionText_findsMatchingRows() throws Exception {
        Product p = createProduct("Atomic", ProductMode.ATOMIC);
        createQuestionForProduct(p.getId(), "How many concurrent users at peak?");
        createQuestionForProduct(p.getId(), "What is the data retention policy?");

        mvc.perform(get("/api/catalog/questions")
                .with(user(admin))
                .param("search", "concurrent"))
            .andExpect(jsonPath("$.totalElements").value(1));
    }

    // ---- delete ------------------------------------------------------------

    @Test
    void delete_writesSingleDeletedRow_noTypedNameRequired() throws Exception {
        Product p = createProduct("Atomic", ProductMode.ATOMIC);
        CriticalQuestion q = createQuestionForProduct(p.getId(), "Delete me");

        mvc.perform(asAdmin(delete("/api/catalog/questions/" + q.getId())))
            .andExpect(status().isNoContent());

        assertThat(questionRepository.findById(q.getId())).isEmpty();
        long deletedRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(CriticalQuestion.ENTITY_TYPE, q.getId())
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(deletedRows).isEqualTo(1);
    }

    // ---- helpers -----------------------------------------------------------

    private long countReorderedRows(Long questionId) {
        return changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(CriticalQuestion.ENTITY_TYPE, questionId)
            .stream().filter(r -> r.getAction() == ChangeAction.REORDERED).count();
    }

    // ---- typed questions (UX-2) --------------------------------------------

    @Test
    void create_defaultsToLongText() throws Exception {
        Product p = createProduct("Atomic LT", ProductMode.ATOMIC);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionText", "Describe the ask"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.questionType").value("LONG_TEXT"))
            .andExpect(jsonPath("$.options").isEmpty());
    }

    @Test
    void createSingleSelect_withOptions_succeeds() throws Exception {
        Product p = createProduct("Atomic SS", ProductMode.ATOMIC);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionText", "Rollout scope?",
                    "questionType", "SINGLE_SELECT",
                    "options", List.of("Pilot", " Full rollout ", "Pilot")
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.questionType").value("SINGLE_SELECT"))
            // trimmed + deduped, order preserved
            .andExpect(jsonPath("$.options[0]").value("Pilot"))
            .andExpect(jsonPath("$.options[1]").value("Full rollout"))
            .andExpect(jsonPath("$.options.length()").value(2));
    }

    @Test
    void createSingleSelect_withTooFewOptions_returns400() throws Exception {
        Product p = createProduct("Atomic SS2", ProductMode.ATOMIC);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionText", "Rollout scope?",
                    "questionType", "SINGLE_SELECT",
                    "options", List.of("OnlyOne")
                ))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void create_withUnknownType_returns400() throws Exception {
        Product p = createProduct("Atomic UT", ProductMode.ATOMIC);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionText", "Whatever",
                    "questionType", "MULTI_SELECT"
                ))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void update_typeAwayFromSingleSelect_clearsOptions() throws Exception {
        Product p = createProduct("Atomic UP", ProductMode.ATOMIC);
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/questions"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "questionText", "Rollout scope?",
                    "questionType", "SINGLE_SELECT",
                    "options", List.of("Pilot", "Full rollout")
                ))))
            .andExpect(status().isCreated());
        Long id = questionRepository.findByProductIdOrderByDisplayOrder(p.getId()).get(0).getId();

        mvc.perform(asAdmin(patch("/api/catalog/questions/" + id))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionType", "YES_NO"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.questionType").value("YES_NO"))
            .andExpect(jsonPath("$.options").isEmpty());

        assertThat(questionRepository.findById(id).orElseThrow().getOptionsJson()).isNull();
    }

    @Test
    void update_toSingleSelectWithoutOptions_returns400() throws Exception {
        Product p = createProduct("Atomic UP2", ProductMode.ATOMIC);
        CriticalQuestion q = createQuestionForProduct(p.getId(), "Scope?");

        mvc.perform(asAdmin(patch("/api/catalog/questions/" + q.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("questionType", "SINGLE_SELECT"))))
            .andExpect(status().isBadRequest());
    }

    private Product createProduct(String name, ProductMode mode) {
        Product p = new Product();
        p.setName(name);
        p.setMode(mode);
        p.setActive(true);
        p.setCreatedBy(admin.getUserId());
        p.setUpdatedBy(admin.getUserId());
        return productRepository.save(p);
    }

    private SubFeature createSubFeature(Long productId, String name, boolean active) {
        SubFeature s = new SubFeature();
        s.setProductId(productId);
        s.setName(name);
        s.setActive(active);
        s.setCreatedBy(admin.getUserId());
        s.setUpdatedBy(admin.getUserId());
        return subFeatureRepository.save(s);
    }

    private CriticalQuestion createQuestionForProduct(Long productId, String text) {
        CriticalQuestion q = new CriticalQuestion();
        q.setProductId(productId);
        q.setQuestionText(text);
        q.setActive(true);
        int next = questionRepository.findMaxDisplayOrderForProduct(productId) + 1;
        q.setDisplayOrder(next);
        q.setCreatedBy(admin.getUserId());
        q.setUpdatedBy(admin.getUserId());
        return questionRepository.save(q);
    }

    private CriticalQuestion createQuestionForSubFeature(Long subFeatureId, String text) {
        CriticalQuestion q = new CriticalQuestion();
        q.setSubFeatureId(subFeatureId);
        q.setQuestionText(text);
        q.setActive(true);
        int next = questionRepository.findMaxDisplayOrderForSubFeature(subFeatureId) + 1;
        q.setDisplayOrder(next);
        q.setCreatedBy(admin.getUserId());
        q.setUpdatedBy(admin.getUserId());
        return questionRepository.save(q);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
