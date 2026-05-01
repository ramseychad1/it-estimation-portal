package com.acme.estimator.catalog.templates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
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
 * Covers the seven cases from the Phase 5b prompt for SDLC phase
 * activation under the new template-aware guard.
 *
 * <p>Lives in {@code com.acme.estimator.catalog.templates} (not
 * {@code phases}) so the test setup can reach the template repository
 * directly. The guard implementation lives in this package too — the
 * cross-package contract is what's being verified.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SdlcPhaseActivationGuardTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private EstimateTemplateRepository templateRepository;
    @Autowired private EstimateTemplateLineRepository lineRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;

    @BeforeEach
    void setUp() {
        lineRepository.deleteAll();
        templateRepository.deleteAll();
        productRepository.deleteAll();
        phaseRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
    }

    // ---- 1. Activate previously-inactive phase, NO templates exist → 200 -----

    @Test
    void activateInactivePhase_noTemplates_succeeds() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1, /*active*/ false);

        mvc.perform(asAdmin(post("/api/admin/phases/" + phase.getId() + "/activate")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(true));
    }

    // ---- 2. Activate previously-inactive phase WHILE active templates exist → 409 ---

    @Test
    void activateInactivePhase_whenActiveTemplateExists_returns409() throws Exception {
        // Seed: one active phase + one inactive phase + an atomic product with
        // an active template (created via POST so lines materialise).
        seedPhase("Discovery", 1, /*active*/ true);
        SdlcPhase inactive = seedPhase("Hypercare", 2, /*active*/ false);
        Product p = createAtomic("Eligibility API");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());

        mvc.perform(asAdmin(post("/api/admin/phases/" + inactive.getId() + "/activate")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("TEMPLATES_WOULD_BE_AFFECTED"))
            .andExpect(jsonPath("$.fieldErrors.affectedTemplateCount").value("1"));

        // Confirm the phase did NOT get flipped active.
        assertThat(phaseRepository.findById(inactive.getId()).orElseThrow().isActive()).isFalse();
    }

    // ---- 3. Activate already-active phase → 200, no error --------------------

    @Test
    void activateAlreadyActivePhase_isNoop() throws Exception {
        SdlcPhase active = seedPhase("Discovery", 1, /*active*/ true);
        // Even with a template present, no-op should succeed (guard skips
        // because the phase is already in the desired state).
        Product p = createAtomic("Eligibility API");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"));

        mvc.perform(asAdmin(post("/api/admin/phases/" + active.getId() + "/activate")))
            .andExpect(status().isOk());
    }

    // ---- 4. Reactivation when previously active → deactivated → no template ---

    @Test
    void reactivateAfterDeactivation_noTemplatesEverCreated_succeeds() throws Exception {
        SdlcPhase phase = seedPhase("Discovery", 1, /*active*/ true);
        // Deactivate, no template ever exists.
        mvc.perform(asAdmin(post("/api/admin/phases/" + phase.getId() + "/deactivate")));
        mvc.perform(asAdmin(post("/api/admin/phases/" + phase.getId() + "/activate")))
            .andExpect(status().isOk());
    }

    // ---- 5. Same scenario but a template was created in between → 409 -------

    @Test
    void reactivateAfterDeactivation_butTemplateCreatedInBetween_returns409() throws Exception {
        SdlcPhase target = seedPhase("Discovery", 1, /*active*/ true);
        seedPhase("Build", 2, /*active*/ true); // keep at least one active phase for template materialisation

        // Deactivate Discovery first.
        mvc.perform(asAdmin(post("/api/admin/phases/" + target.getId() + "/deactivate")));

        // Now create a template (with only Build active).
        Product p = createAtomic("Eligibility API");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());

        // Trying to reactivate Discovery now must be blocked.
        mvc.perform(asAdmin(post("/api/admin/phases/" + target.getId() + "/activate")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("TEMPLATES_WOULD_BE_AFFECTED"));
    }

    // ---- 6. Phase reorder still works regardless of template existence ------

    @Test
    void phaseReorder_unaffectedByTemplates() throws Exception {
        SdlcPhase a = seedPhase("Discovery", 1, /*active*/ true);
        SdlcPhase b = seedPhase("Build", 2, /*active*/ true);
        Product p = createAtomic("Eligibility API");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"));

        // Reverse order: [b, a]
        mvc.perform(asAdmin(patch("/api/admin/phases/reorder"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("phaseIds", List.of(b.getId(), a.getId())))))
            .andExpect(status().isOk());

        assertThat(phaseRepository.findById(a.getId()).orElseThrow().getDisplayOrder()).isEqualTo(2);
        assertThat(phaseRepository.findById(b.getId()).orElseThrow().getDisplayOrder()).isEqualTo(1);
    }

    // ---- 7. Phase deactivation is unaffected by templates → 200 -------------

    @Test
    void deactivatePhase_succeedsRegardlessOfTemplates() throws Exception {
        SdlcPhase target = seedPhase("Hypercare", 3, /*active*/ true);
        seedPhase("Discovery", 1, /*active*/ true);
        Product p = createAtomic("Eligibility API");
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/template"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"));

        // Deactivation always succeeds — historical-row preservation is the
        // template's responsibility, not the phase's.
        mvc.perform(asAdmin(post("/api/admin/phases/" + target.getId() + "/deactivate")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));
    }

    // ---- helpers ------------------------------------------------------------

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

    private Product createAtomic(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
