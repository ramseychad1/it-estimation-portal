package com.acme.estimator.phases;

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
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
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
class SdlcPhaseControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(
            userRepository.findByEmailIgnoreCase("admin@local").orElseThrow()
        );
        estimator = new AppUserDetails(
            userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow()
        );
        seedSystemPhases();
    }

    /** Mirrors V4__seed_sdlc_phases.sql so each test starts from the same baseline. */
    private void seedSystemPhases() {
        String[][] seeds = {
            {"Analysis",    "Requirements gathering, business analysis, scoping"},
            {"Design",      "Solution and technical design"},
            {"Development", "Coding, unit testing, code review"},
            {"Testing",     "QA functional and integration testing"},
            {"UAT",         "User acceptance testing with business stakeholders"},
            {"Deploy",      "Release management and deployment"},
            {"Hypercare",   "Post-deployment monitoring and support window"}
        };
        for (int i = 0; i < seeds.length; i++) {
            SdlcPhase p = new SdlcPhase();
            p.setName(seeds[i][0]);
            p.setDescription(seeds[i][1]);
            p.setDisplayOrder(i + 1);
            p.setActive(true);
            p.setSystem(true);
            p.setCreatedBy(admin.getUserId());
            p.setUpdatedBy(admin.getUserId());
            phaseRepository.save(p);
        }
    }

    // ---- visibility ----------------------------------------------------

    @Test
    void list_returnsAllSevenSeededPhasesInDisplayOrder() throws Exception {
        mvc.perform(get("/api/admin/phases").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(7))
            .andExpect(jsonPath("$[0].name").value("Analysis"))
            .andExpect(jsonPath("$[0].displayOrder").value(1))
            .andExpect(jsonPath("$[6].name").value("Hypercare"))
            .andExpect(jsonPath("$[6].displayOrder").value(7))
            .andExpect(jsonPath("$[0].system").value(true));
    }

    // ---- security ------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        mvc.perform(get("/api/admin/phases"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void nonAdmin_returns403() throws Exception {
        mvc.perform(get("/api/admin/phases").with(user(estimator)))
            .andExpect(status().isForbidden());
    }

    // ---- system phase rules -------------------------------------------

    @Test
    void delete_systemPhase_returns403() throws Exception {
        SdlcPhase analysis = phaseRepository.findByNameIgnoreCase("Analysis").orElseThrow();

        mvc.perform(asAdmin(delete("/api/admin/phases/" + analysis.getId()), admin))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("FORBIDDEN"));
    }

    @Test
    void update_systemPhase_canChangeNameAndDescription() throws Exception {
        SdlcPhase analysis = phaseRepository.findByNameIgnoreCase("Analysis").orElseThrow();

        mvc.perform(asAdmin(patch("/api/admin/phases/" + analysis.getId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "Discovery",
                    "description", "Updated description"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Discovery"))
            .andExpect(jsonPath("$.system").value(true));
    }

    @Test
    void deactivate_systemPhase_isAllowed() throws Exception {
        SdlcPhase deploy = phaseRepository.findByNameIgnoreCase("Deploy").orElseThrow();

        mvc.perform(asAdmin(post("/api/admin/phases/" + deploy.getId() + "/deactivate"), admin))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));
    }

    // ---- custom phase CRUD --------------------------------------------

    @Test
    void create_then_delete_customPhase() throws Exception {
        var createResponse = mvc.perform(asAdmin(post("/api/admin/phases"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "Configuration",
                    "description", "Tenant-specific config"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Configuration"))
            .andExpect(jsonPath("$.system").value(false))
            .andExpect(jsonPath("$.displayOrder").value(8))
            .andReturn();

        Long newId = json.readTree(createResponse.getResponse().getContentAsString())
            .get("id").asLong();

        mvc.perform(asAdmin(delete("/api/admin/phases/" + newId), admin))
            .andExpect(status().isNoContent());

        assertThat(phaseRepository.findById(newId)).isEmpty();
    }

    // ---- name conflicts -----------------------------------------------

    @Test
    void create_nameConflictingWithSystem_caseInsensitive_returns409() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/phases"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "analysis"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("CONFLICT"));
    }

    // ---- reorder ------------------------------------------------------

    @Test
    void reorder_happyPath_writesReorderedRowsForChangedOrdersOnly() throws Exception {
        List<SdlcPhase> ordered = phaseRepository.findAllByOrderByDisplayOrderAsc();
        // Swap positions 2 (Design) and 3 (Development); leave others alone.
        List<Long> ids = new ArrayList<>(ordered.stream().map(SdlcPhase::getId).toList());
        Collections.swap(ids, 1, 2);

        mvc.perform(asAdmin(patch("/api/admin/phases/reorder"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("phaseIds", ids))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(7))
            .andExpect(jsonPath("$[1].name").value("Development"))
            .andExpect(jsonPath("$[2].name").value("Design"));

        // Two REORDERED rows total — one for each phase whose order actually changed.
        long reorderedCount = changeLogRepository.findAll().stream()
            .filter(e -> e.getAction() == ChangeAction.REORDERED)
            .count();
        assertThat(reorderedCount).isEqualTo(2);

        // The unchanged Analysis (still at 1) and Testing (still at 4) etc. did not get rows.
        SdlcPhase analysis = phaseRepository.findByNameIgnoreCase("Analysis").orElseThrow();
        List<ChangeLogEntry> analysisHistory = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SdlcPhase.ENTITY_TYPE, analysis.getId());
        assertThat(analysisHistory).isEmpty();
    }

    @Test
    void reorder_withDuplicateId_returns400() throws Exception {
        List<Long> ids = phaseRepository.findAllByOrderByDisplayOrderAsc()
            .stream().map(SdlcPhase::getId).toList();
        List<Long> withDup = new ArrayList<>(ids);
        withDup.set(2, ids.get(0));  // duplicate

        mvc.perform(asAdmin(patch("/api/admin/phases/reorder"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("phaseIds", withDup))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void reorder_withMissingId_returns400() throws Exception {
        List<Long> ids = new ArrayList<>(
            phaseRepository.findAllByOrderByDisplayOrderAsc()
                .stream().map(SdlcPhase::getId).toList()
        );
        ids.remove(ids.size() - 1);  // drop the last id

        mvc.perform(asAdmin(patch("/api/admin/phases/reorder"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("phaseIds", ids))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    // ---- helpers -------------------------------------------------------

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder, AppUserDetails who) {
        return builder.with(user(who)).with(csrf());
    }
}
