package com.acme.estimator.phases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PhaseBenchmarkControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;
    private Long anchorId;
    private Long reqId;

    @BeforeEach
    void setUp() {
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow());
        reqId = seedPhase("Requirements", 1, "0.16", "0.15", "0.24", false);
        anchorId = seedPhase("Design & Develop", 2, "0.30", "0.35", "0.40", true);
        seedPhase("Deploy", 3, "0.03", "0.05", "0.07", false);
    }

    private Long seedPhase(String name, int order, String low, String target, String high, boolean anchor) {
        SdlcPhase p = new SdlcPhase();
        p.setName(name);
        p.setDisplayOrder(order);
        p.setActive(true);
        p.setSystem(true);
        p.setBenchmarkLowPct(new BigDecimal(low));
        p.setBenchmarkTargetPct(new BigDecimal(target));
        p.setBenchmarkHighPct(new BigDecimal(high));
        p.setDefaultOffshorePct(BigDecimal.ZERO);
        p.setDevAnchor(anchor);
        p.setCreatedBy(admin.getUserId());
        p.setUpdatedBy(admin.getUserId());
        return phaseRepository.save(p).getId();
    }

    @Test
    void get_returnsBenchmarksAndDefaultContingency() throws Exception {
        mvc.perform(get("/api/admin/phases/benchmarks").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.defaultContingencyPct").value(0.10))
            .andExpect(jsonPath("$.phases.length()").value(3))
            .andExpect(jsonPath("$.phases[1].name").value("Design & Develop"))
            .andExpect(jsonPath("$.phases[1].devAnchor").value(true));
    }

    @Test
    void put_savesTargetAndMovesAnchor() throws Exception {
        // Move anchor to Requirements and bump its target to 0.20.
        var body = bodyOf("0.12", List.of(
            row(reqId, "0.16", "0.20", "0.24", "0", true),
            row(anchorId, "0.30", "0.35", "0.40", "0", false),
            row(deployId(), "0.03", "0.05", "0.07", "0", false)
        ));

        mvc.perform(put("/api/admin/phases/benchmarks")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.defaultContingencyPct").value(0.12));

        assertThat(phaseRepository.findById(reqId).orElseThrow().getBenchmarkTargetPct())
            .isEqualByComparingTo("0.20");
        assertThat(phaseRepository.findById(reqId).orElseThrow().isDevAnchor()).isTrue();
        assertThat(phaseRepository.findById(anchorId).orElseThrow().isDevAnchor()).isFalse();
    }

    @Test
    void put_rejectsZeroAnchors() throws Exception {
        var body = bodyOf("0.10", List.of(
            row(reqId, "0.16", "0.15", "0.24", "0", false),
            row(anchorId, "0.30", "0.35", "0.40", "0", false),
            row(deployId(), "0.03", "0.05", "0.07", "0", false)
        ));
        mvc.perform(put("/api/admin/phases/benchmarks")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void put_rejectsMultipleAnchors() throws Exception {
        var body = bodyOf("0.10", List.of(
            row(reqId, "0.16", "0.15", "0.24", "0", true),
            row(anchorId, "0.30", "0.35", "0.40", "0", true),
            row(deployId(), "0.03", "0.05", "0.07", "0", false)
        ));
        mvc.perform(put("/api/admin/phases/benchmarks")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void put_rejectsLowGreaterThanHigh() throws Exception {
        var body = bodyOf("0.10", List.of(
            row(reqId, "0.30", "0.15", "0.10", "0", false),
            row(anchorId, "0.30", "0.35", "0.40", "0", true),
            row(deployId(), "0.03", "0.05", "0.07", "0", false)
        ));
        mvc.perform(put("/api/admin/phases/benchmarks")
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void put_forbiddenForNonAdmin() throws Exception {
        var body = bodyOf("0.10", List.of(row(anchorId, "0.30", "0.35", "0.40", "0", true)));
        mvc.perform(put("/api/admin/phases/benchmarks")
                .with(user(estimator)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().isForbidden());
    }

    // ---- helpers ----

    private Long deployId() {
        return phaseRepository.findByNameIgnoreCase("Deploy").orElseThrow().getId();
    }

    private Map<String, Object> row(Long id, String low, String target, String high,
                                    String offshore, boolean anchor) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("benchmarkLowPct", new BigDecimal(low));
        m.put("benchmarkTargetPct", new BigDecimal(target));
        m.put("benchmarkHighPct", new BigDecimal(high));
        m.put("defaultOffshorePct", new BigDecimal(offshore));
        m.put("devAnchor", anchor);
        return m;
    }

    private Map<String, Object> bodyOf(String contingency, List<Map<String, Object>> rows) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("defaultContingencyPct", new BigDecimal(contingency));
        m.put("phases", new ArrayList<>(rows));
        return m;
    }
}
