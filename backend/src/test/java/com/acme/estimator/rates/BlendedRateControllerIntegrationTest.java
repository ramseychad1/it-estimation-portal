package com.acme.estimator.rates;

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
import java.time.LocalDate;
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
class BlendedRateControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private BlendedRateRepository rateRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        rateRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(
            userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow()
        );
    }

    // ---- security ------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        mvc.perform(get("/api/admin/rates")).andExpect(status().isUnauthorized());
    }

    @Test
    void nonAdminPost_returns403() throws Exception {
        // Mutations stay admin-only post-Phase-6b. estimator@local has
        // Solution Owner + Estimator roles; neither grants POST access.
        mvc.perform(post("/api/admin/rates").with(user(estimator)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "100",
                    "offshoreRate", "40",
                    "effectiveDate", LocalDate.now().plusDays(1).toString(),
                    "confirmationAcknowledged", true
                ))))
            .andExpect(status().isForbidden());
    }

    @Test
    void solutionOwnerGet_isAllowed() throws Exception {
        // Phase 6b: GET /api/admin/rates opened to SOs so the review
        // screen's cost preview can pull current rates without inventing
        // a new endpoint. POST/PATCH/DELETE stay admin-only above.
        mvc.perform(get("/api/admin/rates").with(user(estimator)))
            .andExpect(status().isOk());
    }

    // ---- read ----------------------------------------------------------

    @Test
    void get_day1_returnsNullCurrentAndEmptyHistory() throws Exception {
        mvc.perform(get("/api/admin/rates").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.current").doesNotExist())
            .andExpect(jsonPath("$.history.totalElements").value(0));
    }

    // ---- create --------------------------------------------------------

    @Test
    void create_firstRate_writesExactlyOneCreatedAuditRow() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/rates"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "185.00",
                    "offshoreRate", "62.00",
                    "effectiveDate", LocalDate.now().toString(),
                    "note", "Initial setup",
                    "confirmationAcknowledged", true
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.onshoreRate").value(185.00))
            .andExpect(jsonPath("$.current").value(true));

        Long rateId = rateRepository.findAll().get(0).getId();
        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(BlendedRate.ENTITY_TYPE, rateId);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.CREATED);
    }

    @Test
    void create_secondRateWithLaterDate_becomesNewCurrent() throws Exception {
        seedRate("100.00", "50.00", LocalDate.now().minusDays(7));

        mvc.perform(asAdmin(post("/api/admin/rates"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "190.00",
                    "offshoreRate", "65.00",
                    "effectiveDate", LocalDate.now().toString(),
                    "confirmationAcknowledged", true
                ))))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/admin/rates").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.current.onshoreRate").value(190.00))
            .andExpect(jsonPath("$.history.totalElements").value(2));
    }

    @Test
    void create_futureDated_isInHistoryButNotCurrent() throws Exception {
        seedRate("185.00", "62.00", LocalDate.now());

        mvc.perform(asAdmin(post("/api/admin/rates"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "200.00",
                    "offshoreRate", "70.00",
                    "effectiveDate", LocalDate.now().plusDays(7).toString(),
                    "confirmationAcknowledged", true
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.scheduled").value(true))
            .andExpect(jsonPath("$.current").value(false));

        mvc.perform(get("/api/admin/rates").with(user(admin)))
            .andExpect(jsonPath("$.current.onshoreRate").value(185.00))
            .andExpect(jsonPath("$.history.totalElements").value(2))
            // First history row is the future-dated one (effective_date desc)
            .andExpect(jsonPath("$.history.items[0].scheduled").value(true))
            .andExpect(jsonPath("$.history.items[0].current").value(false))
            .andExpect(jsonPath("$.history.items[1].current").value(true));
    }

    @Test
    void create_pastDateWhenRatesExist_returns400() throws Exception {
        seedRate("100.00", "50.00", LocalDate.now());

        mvc.perform(asAdmin(post("/api/admin/rates"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "150.00",
                    "offshoreRate", "55.00",
                    "effectiveDate", LocalDate.now().minusDays(1).toString(),
                    "confirmationAcknowledged", true
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void create_pastDateOnDay1_isAllowed() throws Exception {
        // No rates yet — past-dating during initial setup is allowed.
        mvc.perform(asAdmin(post("/api/admin/rates"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "150.00",
                    "offshoreRate", "55.00",
                    "effectiveDate", LocalDate.now().minusDays(30).toString(),
                    "confirmationAcknowledged", true
                ))))
            .andExpect(status().isCreated());
    }

    @Test
    void create_withoutAcknowledgement_returns400() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/rates"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "150.00",
                    "offshoreRate", "55.00",
                    "effectiveDate", LocalDate.now().toString(),
                    "confirmationAcknowledged", false
                ))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void create_zeroRate_returns400() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/rates"), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "onshoreRate", "0.00",
                    "offshoreRate", "55.00",
                    "effectiveDate", LocalDate.now().toString(),
                    "confirmationAcknowledged", true
                ))))
            .andExpect(status().isBadRequest());
    }

    // ---- immutability: PATCH and DELETE intentionally don't exist ------

    @Test
    void patch_returns405() throws Exception {
        BlendedRate r = seedRate("100.00", "50.00", LocalDate.now());
        mvc.perform(asAdmin(patch("/api/admin/rates/" + r.getId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void delete_returns405() throws Exception {
        BlendedRate r = seedRate("100.00", "50.00", LocalDate.now());
        mvc.perform(asAdmin(delete("/api/admin/rates/" + r.getId()), admin))
            .andExpect(status().isMethodNotAllowed());
    }

    // ---- helpers -------------------------------------------------------

    private BlendedRate seedRate(String onshore, String offshore, LocalDate effectiveDate) {
        BlendedRate r = new BlendedRate();
        r.setOnshoreRate(new java.math.BigDecimal(onshore));
        r.setOffshoreRate(new java.math.BigDecimal(offshore));
        r.setEffectiveDate(effectiveDate);
        r.setCreatedBy(admin.getUserId());
        return rateRepository.save(r);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder b, AppUserDetails who) {
        return b.with(user(who)).with(csrf());
    }
}
