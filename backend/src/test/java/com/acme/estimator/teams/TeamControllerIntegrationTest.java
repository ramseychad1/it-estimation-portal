package com.acme.estimator.teams;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
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
class TeamControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private TeamRepository teamRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        teamRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(
            userRepository.findByEmailIgnoreCase("admin@local").orElseThrow()
        );
        estimator = new AppUserDetails(
            userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow()
        );
    }

    // ---- security ------------------------------------------------------

    @Test
    void anonymous_get_returns401() throws Exception {
        mvc.perform(get("/api/admin/teams"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void nonAdmin_get_returns403() throws Exception {
        mvc.perform(get("/api/admin/teams").with(user(estimator)))
            .andExpect(status().isForbidden());
    }

    @Test
    void nonAdmin_post_returns403() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/teams"), estimator)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Anything"))))
            .andExpect(status().isForbidden());
    }

    // ---- list ----------------------------------------------------------

    @Test
    void list_paginatedAndSearchable() throws Exception {
        createTeam("Backend Platform", "Owns shared services");
        createTeam("Mobile", "iOS + Android engineering");
        createTeam("Data Platform", "Pipelines and warehouses");

        mvc.perform(get("/api/admin/teams")
                .with(user(admin))
                .param("size", "2")
                .param("sort", "name,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(3))
            .andExpect(jsonPath("$.totalPages").value(2))
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.items[0].name").value("Backend Platform"));

        mvc.perform(get("/api/admin/teams")
                .with(user(admin))
                .param("search", "platform"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2));
    }

    // ---- create --------------------------------------------------------

    @Test
    void create_happyPath_returns201_andWritesChangeLogCreated() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/teams"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "Platform Eng",
                    "description", "Shared platform services"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Platform Eng"))
            .andExpect(jsonPath("$.active").value(true));

        Team team = teamRepository.findByNameIgnoreCase("Platform Eng").orElseThrow();
        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Team.ENTITY_TYPE, team.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.CREATED);
    }

    @Test
    void create_duplicateName_returns409() throws Exception {
        createTeam("Duplicate", null);

        mvc.perform(asAdmin(post("/api/admin/teams"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "duplicate"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("CONFLICT"));
    }

    // ---- patch ---------------------------------------------------------

    @Test
    void patch_changesTwoFields_writesExactlyTwoUpdatedRows() throws Exception {
        Team team = createTeam("Old name", "Old description");

        mvc.perform(asAdmin(patch("/api/admin/teams/" + team.getId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "New name",
                    "description", "New description"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("New name"))
            .andExpect(jsonPath("$.description").value("New description"));

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Team.ENTITY_TYPE, team.getId());
        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(r -> assertThat(r.getAction()).isEqualTo(ChangeAction.UPDATED));
        assertThat(rows).extracting(ChangeLogEntry::getFieldName)
            .containsExactlyInAnyOrder("name", "description");
    }

    @Test
    void patch_withNoActualChanges_writesZeroChangeLogRows() throws Exception {
        Team team = createTeam("Same", "Same description");

        mvc.perform(asAdmin(patch("/api/admin/teams/" + team.getId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "Same",
                    "description", "Same description"
                ))))
            .andExpect(status().isOk());

        assertThat(changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Team.ENTITY_TYPE, team.getId()))
            .isEmpty();
    }

    @Test
    void patch_attemptingActiveToggle_returns400() throws Exception {
        Team team = createTeam("Toggle me", null);

        mvc.perform(asAdmin(patch("/api/admin/teams/" + team.getId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("active", false))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    // ---- activate / deactivate ----------------------------------------

    @Test
    void deactivate_flipsStatus_andWritesChangeLogDeactivated() throws Exception {
        Team team = createTeam("Active team", null);

        mvc.perform(asAdmin(post("/api/admin/teams/" + team.getId() + "/deactivate"), admin))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Team.ENTITY_TYPE, team.getId());
        assertThat(rows).extracting(ChangeLogEntry::getAction)
            .contains(ChangeAction.DEACTIVATED);
    }

    // ---- delete --------------------------------------------------------

    @Test
    void delete_returns204_andWritesChangeLogDeleted() throws Exception {
        Team team = createTeam("Goner", null);
        Long id = team.getId();

        mvc.perform(asAdmin(delete("/api/admin/teams/" + id), admin))
            .andExpect(status().isNoContent());

        assertThat(teamRepository.findById(id)).isEmpty();
        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Team.ENTITY_TYPE, id);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.DELETED);
    }

    // ---- bulk per-row ---------------------------------------------------

    @Test
    void bulkDeactivate_partialFailure_returnsPerRowResults() throws Exception {
        Team a = createTeam("Bulk A", null);
        Team b = createTeam("Bulk B", null);
        long missingId = 999_999L;

        mvc.perform(asAdmin(post("/api/admin/teams/bulk/deactivate"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "ids", List.of(a.getId(), b.getId(), missingId)
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.succeeded.length()").value(2))
            .andExpect(jsonPath("$.failed.length()").value(1))
            .andExpect(jsonPath("$.failed[0].id").value(missingId))
            .andExpect(jsonPath("$.failed[0].error").value("NOT_FOUND"));

        // Successful rows actually committed — partial failure must not roll them back.
        assertThat(teamRepository.findById(a.getId()).orElseThrow().isActive()).isFalse();
        assertThat(teamRepository.findById(b.getId()).orElseThrow().isActive()).isFalse();
    }

    // ---- export --------------------------------------------------------

    @Test
    void export_returnsCsvWithBomAndQuotedFields() throws Exception {
        createTeam("Has, comma", "needs quoting");

        var result = mvc.perform(get("/api/admin/teams/export")
                .with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition",
                org.hamcrest.Matchers.containsString("teams_export_")))
            .andExpect(content().contentTypeCompatibleWith("text/csv"))
            .andReturn();

        byte[] bytes = result.getResponse().getContentAsByteArray();
        // UTF-8 BOM
        assertThat(bytes[0] & 0xFF).isEqualTo(0xEF);
        assertThat(bytes[1] & 0xFF).isEqualTo(0xBB);
        assertThat(bytes[2] & 0xFF).isEqualTo(0xBF);
        String text = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        assertThat(text).contains("\"Has, comma\"");
        assertThat(text).contains("\"needs quoting\"");
    }

    // ---- helpers -------------------------------------------------------

    private Team createTeam(String name, String description) {
        Team t = new Team();
        t.setName(name);
        t.setDescription(description);
        t.setActive(true);
        t.setCreatedBy(admin.getUserId());
        t.setUpdatedBy(admin.getUserId());
        return teamRepository.save(t);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder, AppUserDetails who) {
        return builder.with(user(who)).with(csrf());
    }
}
