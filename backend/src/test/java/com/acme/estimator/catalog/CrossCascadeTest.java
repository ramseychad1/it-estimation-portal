package com.acme.estimator.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
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

/**
 * The contract: deleting a Product (or SubFeature) writes EXACTLY ONE
 * {@code DELETED} change_log row at the parent level. Children are
 * cascade-deleted at the DB layer with no per-child audit rows.
 *
 * Documented in the prompt + ProductService.delete javadoc; this test
 * pins the behaviour so a future refactor that helpfully adds child-row
 * audit writes fails loudly.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class CrossCascadeTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private ProductRepository productRepository;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private CriticalQuestionRepository questionRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;

    @BeforeEach
    void setUp() {
        questionRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
    }

    @Test
    void deleteContainerProduct_purgesSubFeaturesAndQuestions_singleDeletedRow() throws Exception {
        // Setup: container product with 2 sub-features, each with 2 questions
        // (4 questions total).
        Product p = createProduct("Mobile App", ProductMode.CONTAINER);
        SubFeature s1 = createSubFeature(p.getId(), "iOS");
        SubFeature s2 = createSubFeature(p.getId(), "Android");
        Long q1 = createSubFeatureQuestion(s1.getId(), "Q1").getId();
        Long q2 = createSubFeatureQuestion(s1.getId(), "Q2").getId();
        Long q3 = createSubFeatureQuestion(s2.getId(), "Q3").getId();
        Long q4 = createSubFeatureQuestion(s2.getId(), "Q4").getId();

        // Seed an UPDATE on one of the children so we can assert pre-delete
        // history is present for that child even after cascade.
        changeLogRepository.deleteAll(); // clear CREATED rows from setup
        // (no UPDATE writes needed for the assertion shape below)

        Long productId = p.getId();
        mvc.perform(asAdmin(delete("/api/catalog/products/" + productId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "Mobile App"))))
            .andExpect(status().isNoContent());

        // Cascade verification: parent gone, children gone.
        assertThat(productRepository.findById(productId)).isEmpty();
        assertThat(subFeatureRepository.findAllById(List.of(s1.getId(), s2.getId()))).isEmpty();
        assertThat(questionRepository.findAllById(List.of(q1, q2, q3, q4))).isEmpty();

        // Audit-row contract: ONE DELETED row at the parent (Product),
        // ZERO at the children. The DB cascade is implicit; we don't loop
        // children to write per-child audit rows.
        List<ChangeLogEntry> productRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, productId);
        long productDeletes = productRows.stream()
            .filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(productDeletes).isEqualTo(1);

        for (Long subId : List.of(s1.getId(), s2.getId())) {
            long subDeletes = changeLogRepository
                .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SubFeature.ENTITY_TYPE, subId)
                .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
            assertThat(subDeletes).isEqualTo(0);
        }
        for (Long qid : List.of(q1, q2, q3, q4)) {
            long qDeletes = changeLogRepository
                .findByEntityTypeAndEntityIdOrderByChangedAtDesc(CriticalQuestion.ENTITY_TYPE, qid)
                .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
            assertThat(qDeletes).isEqualTo(0);
        }
    }

    @Test
    void deleteAtomicProduct_purgesItsQuestions_singleDeletedRow() throws Exception {
        // Atomic product holds questions directly. Delete the product →
        // its questions are cascade-purged with no per-question DELETED rows.
        Product p = createProduct("Eligibility API", ProductMode.ATOMIC);
        Long q1 = createProductQuestion(p.getId(), "Q1").getId();
        Long q2 = createProductQuestion(p.getId(), "Q2").getId();
        Long q3 = createProductQuestion(p.getId(), "Q3").getId();

        changeLogRepository.deleteAll();

        Long productId = p.getId();
        mvc.perform(asAdmin(delete("/api/catalog/products/" + productId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "ELIGIBILITY API"))))
            .andExpect(status().isNoContent());

        assertThat(productRepository.findById(productId)).isEmpty();
        assertThat(questionRepository.findAllById(List.of(q1, q2, q3))).isEmpty();

        long productDeletes = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, productId)
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(productDeletes).isEqualTo(1);

        for (Long qid : List.of(q1, q2, q3)) {
            long qDeletes = changeLogRepository
                .findByEntityTypeAndEntityIdOrderByChangedAtDesc(CriticalQuestion.ENTITY_TYPE, qid)
                .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
            assertThat(qDeletes).isEqualTo(0);
        }
    }

    @Test
    void deleteSubFeature_purgesItsQuestions_singleDeletedRow() throws Exception {
        // Same contract scoped to a SubFeature delete (parent stays put).
        Product p = createProduct("Mobile App", ProductMode.CONTAINER);
        SubFeature s = createSubFeature(p.getId(), "iOS");
        Long q1 = createSubFeatureQuestion(s.getId(), "Q1").getId();
        Long q2 = createSubFeatureQuestion(s.getId(), "Q2").getId();

        changeLogRepository.deleteAll();

        Long subId = s.getId();
        mvc.perform(asAdmin(delete("/api/catalog/sub-features/" + subId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "ios"))))
            .andExpect(status().isNoContent());

        assertThat(productRepository.findById(p.getId())).isPresent();
        assertThat(subFeatureRepository.findById(subId)).isEmpty();
        assertThat(questionRepository.findAllById(List.of(q1, q2))).isEmpty();

        long subDeletes = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SubFeature.ENTITY_TYPE, subId)
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(subDeletes).isEqualTo(1);

        for (Long qid : List.of(q1, q2)) {
            long qDeletes = changeLogRepository
                .findByEntityTypeAndEntityIdOrderByChangedAtDesc(CriticalQuestion.ENTITY_TYPE, qid)
                .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
            assertThat(qDeletes).isEqualTo(0);
        }
    }

    // ---- helpers -----------------------------------------------------------

    private Product createProduct(String name, ProductMode mode) {
        Product p = new Product();
        p.setName(name);
        p.setMode(mode);
        p.setActive(true);
        p.setCreatedBy(admin.getUserId());
        p.setUpdatedBy(admin.getUserId());
        return productRepository.save(p);
    }

    private SubFeature createSubFeature(Long productId, String name) {
        SubFeature s = new SubFeature();
        s.setProductId(productId);
        s.setName(name);
        s.setActive(true);
        s.setCreatedBy(admin.getUserId());
        s.setUpdatedBy(admin.getUserId());
        return subFeatureRepository.save(s);
    }

    private CriticalQuestion createProductQuestion(Long productId, String text) {
        CriticalQuestion q = new CriticalQuestion();
        q.setProductId(productId);
        q.setQuestionText(text);
        q.setActive(true);
        q.setDisplayOrder(questionRepository.findMaxDisplayOrderForProduct(productId) + 1);
        q.setCreatedBy(admin.getUserId());
        q.setUpdatedBy(admin.getUserId());
        return questionRepository.save(q);
    }

    private CriticalQuestion createSubFeatureQuestion(Long subFeatureId, String text) {
        CriticalQuestion q = new CriticalQuestion();
        q.setSubFeatureId(subFeatureId);
        q.setQuestionText(text);
        q.setActive(true);
        q.setDisplayOrder(questionRepository.findMaxDisplayOrderForSubFeature(subFeatureId) + 1);
        q.setCreatedBy(admin.getUserId());
        q.setUpdatedBy(admin.getUserId());
        return questionRepository.save(q);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
