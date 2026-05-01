package com.acme.estimator.catalog.templates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
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
 * The contract: deleting an Atomic Product (or SubFeature) cascades to
 * its template + lines, with EXACTLY ONE DELETED row at the parent —
 * no per-template DELETED rows, no per-line audit. Same shape as the
 * Phase 5a {@code CrossCascadeTest} pattern.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EstimateTemplateCascadeTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EstimateTemplateRepository templateRepository;
    @Autowired private EstimateTemplateLineRepository lineRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private CriticalQuestionRepository questionRepository;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;

    @BeforeEach
    void setUp() {
        lineRepository.deleteAll();
        templateRepository.deleteAll();
        questionRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();

        seedPhase("Discovery", 1);
        seedPhase("Build", 2);

        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
    }

    @Test
    void deleteAtomicProductWithActiveTemplate_purgesTemplateAndLines_singleDeletedRow() throws Exception {
        Product p = createAtomic("Eligibility API");
        // Create template via the controller so the lines materialise.
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"));
        EstimateTemplate template = templateRepository.findActiveByProductId(p.getId()).orElseThrow();
        Long templateId = template.getId();
        assertThat(lineRepository.findAllByTemplateId(templateId)).hasSize(2);

        // Clear the change_log so the assertion is unambiguous about the delete.
        changeLogRepository.deleteAll();

        Long productId = p.getId();
        mvc.perform(asAdmin(delete("/api/catalog/products/" + productId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "Eligibility API"))));

        assertThat(productRepository.findById(productId)).isEmpty();
        assertThat(templateRepository.findById(templateId)).isEmpty();
        assertThat(lineRepository.findAllByTemplateId(templateId)).isEmpty();

        // Exactly ONE DELETED row at the parent. ZERO at the template.
        long parentDeletes = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, productId)
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(parentDeletes).isEqualTo(1);

        long templateDeletes = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(EstimateTemplate.ENTITY_TYPE, templateId)
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(templateDeletes).isEqualTo(0);
    }

    @Test
    void deleteSubFeatureWithActiveTemplate_purgesTemplateAndLines_singleDeletedRow() throws Exception {
        Product container = createContainer("Container");
        SubFeature sub = createSubFeature(container.getId(), "Variant A");
        mvc.perform(asAdmin(post("/api/catalog/sub-features/" + sub.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"));
        EstimateTemplate template = templateRepository.findActiveBySubFeatureId(sub.getId()).orElseThrow();
        Long templateId = template.getId();

        changeLogRepository.deleteAll();

        Long subId = sub.getId();
        mvc.perform(asAdmin(delete("/api/catalog/sub-features/" + subId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "Variant A"))));

        assertThat(subFeatureRepository.findById(subId)).isEmpty();
        assertThat(templateRepository.findById(templateId)).isEmpty();
        assertThat(lineRepository.findAllByTemplateId(templateId)).isEmpty();
        assertThat(productRepository.findById(container.getId())).isPresent();

        long parentDeletes = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SubFeature.ENTITY_TYPE, subId)
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(parentDeletes).isEqualTo(1);

        long templateDeletes = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(EstimateTemplate.ENTITY_TYPE, templateId)
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(templateDeletes).isEqualTo(0);
    }

    @Test
    void deactivatingPhase_doesNotCascadeAffectTemplates() throws Exception {
        // Create template covering 2 phases. Then deactivate one phase.
        // Template + lines stay put; the deactivated phase row persists in
        // existing templates as historical data.
        Product p = createAtomic("Eligibility API");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"));
        EstimateTemplate template = templateRepository.findActiveByProductId(p.getId()).orElseThrow();
        List<EstimateTemplateLine> linesBefore = lineRepository.findAllByTemplateId(template.getId());
        assertThat(linesBefore).hasSize(2);

        SdlcPhase build = phaseRepository.findByNameIgnoreCase("Build").orElseThrow();
        build.setActive(false);
        phaseRepository.save(build);

        // Template still active, lines untouched.
        EstimateTemplate stillActive = templateRepository.findActiveByProductId(p.getId()).orElseThrow();
        assertThat(stillActive.getId()).isEqualTo(template.getId());
        assertThat(lineRepository.findAllByTemplateId(template.getId())).hasSize(2);
    }

    // ---- helpers -----------------------------------------------------------

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

    private Product createAtomic(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private Product createContainer(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.CONTAINER);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private SubFeature createSubFeature(Long productId, String name) {
        SubFeature s = new SubFeature();
        s.setProductId(productId);
        s.setName(name);
        s.setActive(true);
        s.setCreatedBy(1L);
        s.setUpdatedBy(1L);
        return subFeatureRepository.save(s);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
