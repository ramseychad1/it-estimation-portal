package com.acme.estimator.catalog.templates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
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
class EstimateTemplateControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private EstimateTemplateRepository templateRepository;
    @Autowired private EstimateTemplateLineRepository lineRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        // Cascade-safe order: lines → templates → questions → sub-features → products → phases.
        lineRepository.deleteAll();
        templateRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();

        // Seed three active SDLC phases.
        seedPhase("Discovery", 1, true);
        seedPhase("Build", 2, true);
        seedPhase("Hypercare", 3, true);

        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow());
    }

    // ---- security ----------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        Product p = createAtomicProduct("Eligibility API");
        mvc.perform(get("/api/catalog/products/" + p.getId() + "/template"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void solutionOwner_canAccess() throws Exception {
        Product p = createAtomicProduct("Eligibility API");
        mvc.perform(get("/api/catalog/products/" + p.getId() + "/template").with(user(estimator)))
            .andExpect(status().isOk());
    }

    // ---- Day 1 -------------------------------------------------------------

    @Test
    void getTemplate_dayOne_returnsNullBodyWith200() throws Exception {
        Product p = createAtomicProduct("Day One Product");
        mvc.perform(get("/api/catalog/products/" + p.getId() + "/template").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(content().string("")); // null serializes to empty body via @JsonInclude(NON_NULL)
    }

    @Test
    void postTemplate_materializesOneLinePerActivePhase_withZeroHours() throws Exception {
        Product p = createAtomicProduct("Eligibility API");

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.versionNumber").value(1))
            .andExpect(jsonPath("$.active").value(true))
            .andExpect(jsonPath("$.lines.length()").value(3));

        EstimateTemplate t = templateRepository.findActiveByProductId(p.getId()).orElseThrow();
        List<EstimateTemplateLine> lines = lineRepository.findAllByTemplateId(t.getId());
        assertThat(lines).hasSize(3);
        assertThat(lines).allSatisfy(l -> {
            assertThat(l.getOnshoreLow()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(l.getOnshoreMed()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(l.getOnshoreHigh()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(l.getOffshoreLow()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(l.getOffshoreMed()).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(l.getOffshoreHigh()).isEqualByComparingTo(BigDecimal.ZERO);
        });

        // One CREATED change_log row.
        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(EstimateTemplate.ENTITY_TYPE, t.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.CREATED);
    }

    @Test
    void postTemplate_onContainerProduct_returns400_invalidProductMode() throws Exception {
        Product container = createContainerProduct("Mobile App");

        mvc.perform(asAdmin(post("/api/catalog/products/" + container.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_PRODUCT_MODE"));
    }

    @Test
    void postTemplate_whenActiveExists_returns409_alreadyExists() throws Exception {
        Product p = createAtomicProduct("Existing");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("ALREADY_EXISTS"));
    }

    // ---- save new version --------------------------------------------------

    @Test
    void putTemplate_savesNewVersion_andFlipsPreviousInactive() throws Exception {
        Product p = createAtomicProduct("Versioned");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());

        // Build a body with all 3 phases, set onshoreLow to 10/20/30.
        List<SdlcPhase> phases = phaseRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        List<Map<String, Object>> lines = new ArrayList<>();
        for (int i = 0; i < phases.size(); i++) {
            BigDecimal lowVal = new BigDecimal((i + 1) * 10);
            lines.add(Map.of(
                "sdlcPhaseId", phases.get(i).getId(),
                "onshoreLow", lowVal,
                "onshoreMed", BigDecimal.ZERO,
                "onshoreHigh", BigDecimal.ZERO,
                "offshoreLow", BigDecimal.ZERO,
                "offshoreMed", BigDecimal.ZERO,
                "offshoreHigh", BigDecimal.ZERO
            ));
        }

        mvc.perform(asAdmin(put("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "lines", lines,
                    "changeReason", "First real save"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.versionNumber").value(2))
            .andExpect(jsonPath("$.active").value(true))
            .andExpect(jsonPath("$.changeReason").value("First real save"));

        // Both rows exist; only one is active.
        List<EstimateTemplate> all = templateRepository.findAllByProductIdOrderByVersionNumberDesc(p.getId());
        assertThat(all).hasSize(2);
        assertThat(all.stream().filter(EstimateTemplate::isActive).count()).isEqualTo(1);

        // Two CREATED rows in change_log (one per version), zero UPDATED on the previous.
        List<ChangeLogEntry> rows = changeLogRepository.findAll().stream()
            .filter(r -> r.getEntityType().equals(EstimateTemplate.ENTITY_TYPE)).toList();
        assertThat(rows).extracting(ChangeLogEntry::getAction)
            .containsExactlyInAnyOrder(ChangeAction.CREATED, ChangeAction.CREATED);
    }

    @Test
    void putTemplate_missingPhaseRow_returns400() throws Exception {
        Product p = createAtomicProduct("Missing");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());

        // Body covers only 2 of the 3 phases.
        List<SdlcPhase> phases = phaseRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        List<Map<String, Object>> lines = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            lines.add(zeroLine(phases.get(i).getId()));
        }

        mvc.perform(asAdmin(put("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("lines", lines))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void putTemplate_extraRowForUnknownPhase_returns400() throws Exception {
        Product p = createAtomicProduct("Extra");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());

        // Cover all 3 active phases plus a bogus 99999 id.
        List<SdlcPhase> phases = phaseRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        List<Map<String, Object>> lines = new ArrayList<>();
        for (SdlcPhase ph : phases) lines.add(zeroLine(ph.getId()));
        lines.add(zeroLine(99999L));

        mvc.perform(asAdmin(put("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("lines", lines))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void putTemplate_negativeHours_returns400() throws Exception {
        Product p = createAtomicProduct("Negative");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());

        List<SdlcPhase> phases = phaseRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        List<Map<String, Object>> lines = new ArrayList<>();
        for (int i = 0; i < phases.size(); i++) {
            BigDecimal v = i == 0 ? new BigDecimal("-1") : BigDecimal.ZERO;
            lines.add(Map.of(
                "sdlcPhaseId", phases.get(i).getId(),
                "onshoreLow", v,
                "onshoreMed", BigDecimal.ZERO,
                "onshoreHigh", BigDecimal.ZERO,
                "offshoreLow", BigDecimal.ZERO,
                "offshoreMed", BigDecimal.ZERO,
                "offshoreHigh", BigDecimal.ZERO
            ));
        }

        mvc.perform(asAdmin(put("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("lines", lines))))
            .andExpect(status().isBadRequest());
    }

    // ---- sub-feature flow --------------------------------------------------

    @Test
    void postTemplate_onSubFeature_creates_andLinesMaterialize() throws Exception {
        Product container = createContainerProduct("Container");
        SubFeature sub = createSubFeature(container.getId(), "Variant A");

        mvc.perform(asAdmin(post("/api/catalog/sub-features/" + sub.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.versionNumber").value(1))
            .andExpect(jsonPath("$.subFeatureId").value(sub.getId()))
            .andExpect(jsonPath("$.lines.length()").value(3));
    }

    // ---- helpers -----------------------------------------------------------

    private SdlcPhase seedPhase(String name, int order, boolean active) {
        SdlcPhase p = new SdlcPhase();
        p.setName(name);
        p.setDisplayOrder(order);
        p.setActive(active);
        p.setSystem(false);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return phaseRepository.save(p);
    }

    private Product createAtomicProduct(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private Product createContainerProduct(String name) {
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

    private static Map<String, Object> zeroLine(Long phaseId) {
        return Map.of(
            "sdlcPhaseId", phaseId,
            "onshoreLow", BigDecimal.ZERO,
            "onshoreMed", BigDecimal.ZERO,
            "onshoreHigh", BigDecimal.ZERO,
            "offshoreLow", BigDecimal.ZERO,
            "offshoreMed", BigDecimal.ZERO,
            "offshoreHigh", BigDecimal.ZERO
        );
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
