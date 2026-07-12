package com.acme.estimator.phases;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Benchmark fields + dev-anchor movement through the phase PATCH endpoint. */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SdlcPhaseBenchmarkUpdateTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private Long reqId;
    private Long anchorId;

    @BeforeEach
    void setUp() {
        phaseRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        reqId = seedPhase("Requirements", 1, "0.16", "0.15", "0.24", false);
        anchorId = seedPhase("Design & Develop", 2, "0.30", "0.35", "0.40", true);
    }

    private Long seedPhase(String name, int order, String low, String mid, String high, boolean anchor) {
        SdlcPhase p = new SdlcPhase();
        p.setName(name);
        p.setDisplayOrder(order);
        p.setActive(true);
        p.setSystem(true);
        p.setBenchmarkLowPct(new BigDecimal(low));
        p.setBenchmarkMidPct(new BigDecimal(mid));
        p.setBenchmarkHighPct(new BigDecimal(high));
        p.setDefaultOffshorePct(BigDecimal.ZERO);
        p.setDevAnchor(anchor);
        p.setCreatedBy(admin.getUserId());
        p.setUpdatedBy(admin.getUserId());
        return phaseRepository.save(p).getId();
    }

    private void patchPhase(Long id, Map<String, Object> body, int expectedStatus) throws Exception {
        mvc.perform(patch("/api/admin/phases/" + id)
                .with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
            .andExpect(status().is(expectedStatus));
    }

    @Test
    void patch_setsBenchmarkFields() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("benchmarkMidPct", new BigDecimal("0.20"));
        body.put("defaultOffshorePct", new BigDecimal("0.30"));
        patchPhase(reqId, body, 200);

        SdlcPhase p = phaseRepository.findById(reqId).orElseThrow();
        assertThat(p.getBenchmarkMidPct()).isEqualByComparingTo("0.20");
        assertThat(p.getDefaultOffshorePct()).isEqualByComparingTo("0.30");
    }

    @Test
    void patch_rejectsLowGreaterThanHigh() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("benchmarkLowPct", new BigDecimal("0.50")); // > existing high 0.24
        patchPhase(reqId, body, 400);
    }

    @Test
    void patch_movingAnchorClearsPrevious() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("devAnchor", true);
        patchPhase(reqId, body, 200);

        assertThat(phaseRepository.findById(reqId).orElseThrow().isDevAnchor()).isTrue();
        assertThat(phaseRepository.findById(anchorId).orElseThrow().isDevAnchor()).isFalse();
    }

    @Test
    void patch_rejectsUnsettingSoleAnchor() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("devAnchor", false);
        patchPhase(anchorId, body, 400);
    }
}
