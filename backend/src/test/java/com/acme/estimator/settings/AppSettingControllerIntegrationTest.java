package com.acme.estimator.settings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * SEC-2: the settings endpoint must never return credential values in
 * cleartext, and echoing the mask back on save must not wipe a real secret.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class AppSettingControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private AppSettingRepository repo;
    @Autowired private AppSettingService service;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;

    @BeforeEach
    void setUp() {
        repo.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        seed(AppSettingService.KEY_EMAIL_SMTP_PASSWORD, "hunter2-real-smtp-pw");
        seed(AppSettingService.KEY_EMAIL_RESEND_API_KEY, "re_live_secret_key");
        seed(AppSettingService.KEY_EMAIL_GMAIL_CLIENT_SECRET, "gcp-client-secret");
        seed(AppSettingService.KEY_EMAIL_GMAIL_REFRESH_TOKEN, "1//refresh-token-value");
        seed(AppSettingService.KEY_EMAIL_SMTP_HOST, "smtp.example.com");
    }

    @Test
    void getAll_masksSecrets_butKeepsNonSecrets() throws Exception {
        String body = mvc.perform(get("/api/admin/settings").with(user(admin)))
            .andExpect(status().isOk())
            // Non-secret values pass through unchanged.
            .andExpect(jsonPath("$.email_smtp_host").value("smtp.example.com"))
            // Secrets are masked — the sentinel, never the value.
            .andExpect(jsonPath("$.email_smtp_password").value("********"))
            .andExpect(jsonPath("$.email_resend_api_key").value("********"))
            .andExpect(jsonPath("$.email_gmail_client_secret").value("********"))
            .andExpect(jsonPath("$.email_gmail_refresh_token").value("********"))
            .andReturn().getResponse().getContentAsString();

        // Belt and suspenders: the raw secrets appear nowhere in the payload.
        assertThat(body).doesNotContain("hunter2-real-smtp-pw");
        assertThat(body).doesNotContain("re_live_secret_key");
        assertThat(body).doesNotContain("gcp-client-secret");
        assertThat(body).doesNotContain("refresh-token-value");
    }

    @Test
    void unsetSecret_isNeverMasked() throws Exception {
        // No row → the key is simply absent (unset). A blank row → "".
        // Either way it must never surface the mask, which would falsely
        // imply a credential is configured.
        repo.deleteById(AppSettingService.KEY_EMAIL_SMTP_PASSWORD);
        mvc.perform(get("/api/admin/settings").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email_smtp_password").doesNotExist());

        seed(AppSettingService.KEY_EMAIL_SMTP_PASSWORD, "");
        mvc.perform(get("/api/admin/settings").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email_smtp_password").value(""));
    }

    @Test
    void put_echoingMaskBack_leavesTheRealSecretIntact() throws Exception {
        // Simulate a client that round-trips the masked value it received.
        mvc.perform(put("/api/admin/settings").with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "email_smtp_password", "********",
                    "email_from_name", "Renamed Sender"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email_smtp_password").value("********"));

        // The stored secret is unchanged (raw check via the internal accessor).
        assertThat(service.getAll().get(AppSettingService.KEY_EMAIL_SMTP_PASSWORD))
            .isEqualTo("hunter2-real-smtp-pw");
    }

    @Test
    void put_withNewSecretValue_persistsIt() throws Exception {
        mvc.perform(put("/api/admin/settings").with(user(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "email_smtp_password", "brand-new-password"
                ))))
            .andExpect(status().isOk());

        assertThat(service.getAll().get(AppSettingService.KEY_EMAIL_SMTP_PASSWORD))
            .isEqualTo("brand-new-password");
    }

    private void seed(String key, String value) {
        AppSetting s = new AppSetting();
        s.setKey(key);
        s.setValue(value);
        s.setUpdatedAt(OffsetDateTime.now());
        repo.save(s);
    }
}
