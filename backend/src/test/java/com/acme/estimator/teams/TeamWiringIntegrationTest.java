package com.acme.estimator.teams;

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
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.estimates.EstimateRequestRepository;
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
class TeamWiringIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private TeamRepository teamRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private EstimateRequestRepository estimateRequestRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;

    private AppUserDetails admin;

    @BeforeEach
    void setUp() {
        // Clear in FK-safe order: estimates → products → teams (CASCADE → user_teams)
        estimateRequestRepository.deleteAll();
        productRepository.deleteAll();
        teamRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
    }

    // ---- user-team assignment ------------------------------------------

    @Test
    void assignUser_toTwoTeams_returnsBothInUserDetail() throws Exception {
        Team t1 = createTeam("Alpha Team");
        Team t2 = createTeam("Beta Team");

        mvc.perform(asAdmin(patch("/api/admin/users/" + admin.getUserId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("teamIds", List.of(t1.getId(), t2.getId())))))
            .andExpect(status().isOk());

        mvc.perform(asAdmin(get("/api/admin/users/" + admin.getUserId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.teams.length()").value(2));
    }

    @Test
    void updateUserTeams_replaceSet_writesAuditRow() throws Exception {
        Team teamA = createTeam("Team Alpha");
        Team teamB = createTeam("Team Beta");

        // Assign to Team A first
        mvc.perform(asAdmin(patch("/api/admin/users/" + admin.getUserId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("teamIds", List.of(teamA.getId())))))
            .andExpect(status().isOk());

        changeLogRepository.deleteAll();

        // Replace with Team B
        mvc.perform(asAdmin(patch("/api/admin/users/" + admin.getUserId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("teamIds", List.of(teamB.getId())))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.teams[0].name").value("Team Beta"));

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc("User", admin.getUserId());
        assertThat(rows).anyMatch(r ->
            r.getAction() == ChangeAction.UPDATED && "teams".equals(r.getFieldName()));
    }

    @Test
    void inviteUser_withTeams_resultHasTeams() throws Exception {
        Team team = createTeam("Invite Team");

        String response = mvc.perform(asAdmin(post("/api/admin/users/invitations"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "email", "newuser@example.com",
                    "firstName", "New",
                    "lastName", "User",
                    "roleIds", List.of(3),
                    "teamIds", List.of(team.getId())
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.user.teams.length()").value(1))
            .andExpect(jsonPath("$.user.teams[0].name").value("Invite Team"))
            .andReturn().getResponse().getContentAsString();

        assertThat(response).isNotEmpty();
    }

    // ---- product-team assignment ---------------------------------------

    @Test
    void createProduct_withoutTeamId_returns400() throws Exception {
        mvc.perform(asAdmin(post("/api/catalog/products"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "No Team Product",
                    "mode", "ATOMIC"
                    // teamId intentionally omitted
                ))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void updateProduct_team_writesAuditRow() throws Exception {
        Team teamA = createTeam("Product Team A");
        Team teamB = createTeam("Product Team B");
        Product p = createProduct("Test Product", teamA);

        mvc.perform(asAdmin(patch("/api/catalog/products/" + p.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("teamId", teamB.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.team.name").value("Product Team B"));

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, p.getId());
        assertThat(rows).anyMatch(r ->
            r.getAction() == ChangeAction.UPDATED && "team".equals(r.getFieldName()));
    }

    @Test
    void listProducts_filteredByTeamId_returnsCorrectSubset() throws Exception {
        Team t1 = createTeam("Filter Team 1");
        Team t2 = createTeam("Filter Team 2");
        createProduct("Product in T1", t1);
        createProduct("Product in T2", t2);

        mvc.perform(get("/api/catalog/products").with(user(admin))
                .param("teamId", t1.getId().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].name").value("Product in T1"));
    }

    // ---- team delete guard --------------------------------------------

    @Test
    void deleteTeam_withActiveProducts_returns409() throws Exception {
        Team team = createTeam("Team With Products");
        createProduct("Owned Product", team);

        mvc.perform(asAdmin(delete("/api/admin/teams/" + team.getId())))
            .andExpect(status().isConflict());

        assertThat(teamRepository.findById(team.getId())).isPresent();
    }

    @Test
    void deleteTeam_withNoProducts_returns204() throws Exception {
        Team team = createTeam("Empty Team");

        mvc.perform(asAdmin(delete("/api/admin/teams/" + team.getId())))
            .andExpect(status().isNoContent());

        assertThat(teamRepository.findById(team.getId())).isEmpty();
    }

    @Test
    void deactivateTeam_withProducts_returns200() throws Exception {
        Team team = createTeam("Team To Deactivate");
        createProduct("Still Assigned Product", team);

        mvc.perform(asAdmin(post("/api/admin/teams/" + team.getId() + "/deactivate")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        // Product is still assigned; team is just inactive
        Product p = productRepository.findAll().get(0);
        assertThat(p.getTeam()).isNotNull();
    }

    // ---- team list counts ---------------------------------------------

    @Test
    void teamList_showsMemberAndProductCounts() throws Exception {
        Team team = createTeam("Counted Team");
        createProduct("P1", team);
        createProduct("P2", team);

        // Assign admin user to team
        mvc.perform(asAdmin(patch("/api/admin/users/" + admin.getUserId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("teamIds", List.of(team.getId())))))
            .andExpect(status().isOk());

        mvc.perform(asAdmin(get("/api/admin/teams")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].productCount").value(2))
            .andExpect(jsonPath("$.items[0].memberCount").value(1));
    }

    // ---- helpers -------------------------------------------------------

    private Team createTeam(String name) {
        Team t = new Team();
        t.setName(name);
        t.setActive(true);
        t.setCreatedBy(admin.getUserId());
        t.setUpdatedBy(admin.getUserId());
        return teamRepository.save(t);
    }

    private Product createProduct(String name, Team team) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setTeam(team);
        p.setCreatedBy(admin.getUserId());
        p.setUpdatedBy(admin.getUserId());
        return productRepository.save(p);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
