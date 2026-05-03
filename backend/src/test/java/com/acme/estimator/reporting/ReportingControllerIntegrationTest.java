package com.acme.estimator.reporting;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.estimates.EstimateRequestRepository;
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ReportingControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private TeamRepository teamRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private EstimateRequestRepository estimateRequestRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        estimateRequestRepository.deleteAll();
        productRepository.deleteAll();
        teamRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow());
    }

    // ---- security -----------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        mvc.perform(get("/api/reports/team-workload"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void requesterOnly_returns403() throws Exception {
        mvc.perform(get("/api/reports/team-workload")
                .with(user("requester").roles("REQUESTER")))
            .andExpect(status().isForbidden());
    }

    @Test
    void solutionOwner_canAccess() throws Exception {
        // estimator@local has Solution Owner role — should be allowed
        mvc.perform(get("/api/reports/team-workload").with(user(estimator)))
            .andExpect(status().isOk());
    }

    // ---- summary functional -------------------------------------------

    @Test
    void summary_empty_returnsEmptyList() throws Exception {
        mvc.perform(get("/api/reports/team-workload").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void summary_teamWithMembersAndProducts_showsCounts() throws Exception {
        Team team = createTeam("Workload Team");
        createProduct("P1", team);
        createProduct("P2", team);
        addUserToTeam(admin.getUserId(), team.getId());

        mvc.perform(get("/api/reports/team-workload").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].teamName").value("Workload Team"))
            .andExpect(jsonPath("$[0].activeProductCount").value(2))
            .andExpect(jsonPath("$[0].memberCount").value(1));
    }

    @Test
    void summary_teamWithNoRequests_showsZeroRequestCounts() throws Exception {
        createTeam("Quiet Team");

        mvc.perform(get("/api/reports/team-workload").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].totalEstimateRequests").value(0))
            .andExpect(jsonPath("$[0].approvedCount").value(0))
            .andExpect(jsonPath("$[0].totalApprovedCost").value(0));
    }

    // ---- detail endpoint ----------------------------------------------

    @Test
    void detail_returnsMembers_and_products() throws Exception {
        Team team = createTeam("Detail Team");
        createProduct("Detail Product", team);
        addUserToTeam(admin.getUserId(), team.getId());

        mvc.perform(get("/api/reports/team-workload/" + team.getId()).with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.teamId").value(team.getId()))
            .andExpect(jsonPath("$.teamName").value("Detail Team"))
            .andExpect(jsonPath("$.members.length()").value(1))
            .andExpect(jsonPath("$.products.length()").value(1))
            .andExpect(jsonPath("$.products[0].name").value("Detail Product"));
    }

    @Test
    void detail_unknownTeam_returns404() throws Exception {
        mvc.perform(get("/api/reports/team-workload/99999").with(user(admin)))
            .andExpect(status().isNotFound());
    }

    // ---- helpers -------------------------------------------------------

    private void addUserToTeam(Long userId, Long teamId) {
        jdbcTemplate.update("INSERT INTO user_teams (user_id, team_id) VALUES (?, ?)", userId, teamId);
    }

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
}
