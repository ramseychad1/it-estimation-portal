package com.acme.estimator.auth;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class AuthControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    void health_isPublic() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void me_returns401WhenAnonymous() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_withValidCredentials_setsSessionAndReturnsUser() throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginBody("admin@local", "ChangeMe123!"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@local"))
                .andExpect(jsonPath("$.firstName").value("Local"))
                .andExpect(jsonPath("$.lastName").value("Admin"))
                .andExpect(jsonPath("$.roles[0]").value("Admin"))
                .andReturn();

        MockHttpSession session = Objects.requireNonNull(
                (MockHttpSession) result.getRequest().getSession(false),
                "expected login to create a session");

        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@local"));
    }

    @Test
    void login_withInvalidPassword_returns401() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginBody("admin@local", "wrong"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_withUnknownEmail_returns401() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginBody("nobody@local", "whatever123"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_invalidatesSession() throws Exception {
        MvcResult login = mvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(new LoginBody("admin@local", "ChangeMe123!"))))
                .andReturn();
        MockHttpSession session = Objects.requireNonNull(
                (MockHttpSession) login.getRequest().getSession(false));

        mvc.perform(post("/api/auth/logout").with(csrf()).session(session))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_lockedOutAfterRepeatedFailures_returns429() throws Exception {
        // Unique email so this can't lock an account other tests use.
        String email = "brute-force-probe@local";
        for (int i = 0; i < LoginThrottleService.MAX_FAILURES; i++) {
            mvc.perform(post("/api/auth/login").with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(new LoginBody(email, "wrong-guess-" + i))))
                .andExpect(status().isUnauthorized());
        }
        // Next attempt is throttled before credentials are even checked —
        // even a hypothetically-correct password would be rejected now.
        mvc.perform(post("/api/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new LoginBody(email, "any-password-99"))))
            .andExpect(status().isTooManyRequests());
    }

    private record LoginBody(String email, String password) {}
}
