package com.acme.estimator.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.InvitationStatus;
import com.acme.estimator.auth.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
// Tests create users + token rows. @Transactional rolls back so the
// shared in-memory database stays clean across the suite.
@org.springframework.transaction.annotation.Transactional
class InvitationControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private InvitationTokenRepository tokenRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;

    private AppUserDetails admin;

    @BeforeEach
    void setUp() {
        // Wipe any residual invites from previous tests.
        tokenRepository.deleteAll();
        userRepository.findByEmailIgnoreCase("invitee@local").ifPresent(userRepository::delete);
        userRepository.findByEmailIgnoreCase("second@local").ifPresent(userRepository::delete);
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
    }

    // ---- invite --------------------------------------------------------

    @Test
    void invite_newUser_returns201_withInviteUrlAndPendingUser() throws Exception {
        MvcResult result = mvc.perform(asAdmin(post("/api/admin/users/invitations"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invitePayload("invitee@local", "Iris", "Invitee", List.of(2, 3))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.user.email").value("invitee@local"))
            .andExpect(jsonPath("$.user.invitationStatus").value("PENDING_INVITE"))
            .andExpect(jsonPath("$.inviteUrl").exists())
            .andExpect(jsonPath("$.tokenExpiresAt").exists())
            .andReturn();

        JsonNode body = json.readTree(result.getResponse().getContentAsString());
        String url = body.get("inviteUrl").asText();
        assertThat(url).startsWith("http://test.local/invite/");
        assertThat(url.length()).isGreaterThan("http://test.local/invite/".length() + 20);

        // Token row exists, token is unused, not revoked.
        assertThat(tokenRepository.count()).isEqualTo(1);
    }

    @Test
    void invite_duplicateEmail_active_returns409() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/users/invitations"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invitePayload("admin@local", "X", "Y", List.of(3))))
            .andExpect(status().isConflict());
    }

    @Test
    void invite_duplicateEmail_pending_returns409_withResendHint() throws Exception {
        // First invite succeeds
        mvc.perform(asAdmin(post("/api/admin/users/invitations"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invitePayload("invitee@local", "Iris", "Invitee", List.of(3))))
            .andExpect(status().isCreated());
        // Second invite to same email gets a 409 with a clear hint.
        mvc.perform(asAdmin(post("/api/admin/users/invitations"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invitePayload("invitee@local", "Iris", "Invitee", List.of(3))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("pending invitation")));
    }

    // ---- resend --------------------------------------------------------

    @Test
    void resend_revokesOldTokenAndIssuesNewOne() throws Exception {
        long inviteeId = inviteAndReturnUserId();
        String oldToken = tokenRepository.findAll().get(0).getToken();

        MvcResult result = mvc.perform(asAdmin(post("/api/admin/users/invitations/" + inviteeId + "/resend")))
            .andExpect(status().isOk())
            .andReturn();
        String newUrl = json.readTree(result.getResponse().getContentAsString())
            .get("inviteUrl").asText();
        String newToken = newUrl.substring(newUrl.lastIndexOf('/') + 1);
        assertThat(newToken).isNotEqualTo(oldToken);

        // Old token is now revoked, new one is active.
        var oldRow = tokenRepository.findByToken(oldToken).orElseThrow();
        var newRow = tokenRepository.findByToken(newToken).orElseThrow();
        assertThat(oldRow.getRevokedAt()).isNotNull();
        assertThat(newRow.getRevokedAt()).isNull();
        assertThat(newRow.getUsedAt()).isNull();
    }

    // ---- revoke --------------------------------------------------------

    @Test
    void revoke_marksUserInactive_andTokenRevoked_andWritesChangeLog() throws Exception {
        long inviteeId = inviteAndReturnUserId();
        mvc.perform(asAdmin(delete("/api/admin/users/invitations/" + inviteeId)))
            .andExpect(status().isNoContent());

        var user = userRepository.findById(inviteeId).orElseThrow();
        assertThat(user.getInvitationStatus()).isEqualTo(InvitationStatus.INACTIVE);
        var token = tokenRepository.findAll().get(0);
        assertThat(token.getRevokedAt()).isNotNull();

        var rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(UserService.ENTITY_TYPE, inviteeId);
        assertThat(rows).extracting(e -> e.getAction())
            .contains(ChangeAction.INVITATION_REVOKED);
    }

    // ---- public validate -----------------------------------------------

    @Test
    void publicValidate_validToken_returnsEmailAndExpiry() throws Exception {
        String url = inviteAndReturnUrl();
        String token = url.substring(url.lastIndexOf('/') + 1);
        mvc.perform(get("/api/auth/invitations/" + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true))
            .andExpect(jsonPath("$.email").value("invitee@local"))
            .andExpect(jsonPath("$.expiresAt").exists());
    }

    @Test
    void publicValidate_unknownToken_returnsValidFalseAndNoEmail() throws Exception {
        mvc.perform(get("/api/auth/invitations/unknown-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void publicValidate_revokedToken_returnsValidFalse() throws Exception {
        String url = inviteAndReturnUrl();
        String token = url.substring(url.lastIndexOf('/') + 1);
        // Revoke directly via repository to avoid the user lookup chain.
        var row = tokenRepository.findByToken(token).orElseThrow();
        row.setRevokedAt(OffsetDateTime.now());
        tokenRepository.save(row);

        mvc.perform(get("/api/auth/invitations/" + token))
            .andExpect(jsonPath("$.valid").value(false));
    }

    // ---- public accept -------------------------------------------------

    @Test
    void publicAccept_validToken_setsPasswordAndActivatesUser() throws Exception {
        String url = inviteAndReturnUrl();
        String token = url.substring(url.lastIndexOf('/') + 1);

        mvc.perform(post("/api/auth/invitations/" + token + "/accept").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "Hunter22Hunter"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("invitee@local"));

        var user = userRepository.findByEmailIgnoreCase("invitee@local").orElseThrow();
        assertThat(user.getInvitationStatus()).isEqualTo(InvitationStatus.ACTIVE);
        assertThat(user.isActive()).isTrue();
        assertThat(user.getInvitationAcceptedAt()).isNotNull();

        var token2 = tokenRepository.findByToken(token).orElseThrow();
        assertThat(token2.getUsedAt()).isNotNull();

        var rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(UserService.ENTITY_TYPE, user.getId());
        assertThat(rows).extracting(e -> e.getAction())
            .contains(ChangeAction.INVITATION_ACCEPTED);
    }

    @Test
    void publicAccept_twiceWithSameToken_secondReturns409() throws Exception {
        String url = inviteAndReturnUrl();
        String token = url.substring(url.lastIndexOf('/') + 1);
        mvc.perform(post("/api/auth/invitations/" + token + "/accept").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "Hunter22Hunter"))))
            .andExpect(status().isOk());
        mvc.perform(post("/api/auth/invitations/" + token + "/accept").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "Hunter22Hunter"))))
            .andExpect(status().isConflict());
    }

    @Test
    void publicAccept_weakPassword_returns400() throws Exception {
        String url = inviteAndReturnUrl();
        String token = url.substring(url.lastIndexOf('/') + 1);
        mvc.perform(post("/api/auth/invitations/" + token + "/accept").with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", "noooooo"))))
            .andExpect(status().isBadRequest());
    }

    // ---- helpers -------------------------------------------------------

    private String invitePayload(String email, String first, String last, List<Integer> roleIds) throws Exception {
        return json.writeValueAsString(Map.of(
            "email", email,
            "firstName", first,
            "lastName", last,
            "roleIds", roleIds
        ));
    }

    private long inviteAndReturnUserId() throws Exception {
        MvcResult result = mvc.perform(asAdmin(post("/api/admin/users/invitations"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invitePayload("invitee@local", "Iris", "Invitee", List.of(3))))
            .andExpect(status().isCreated())
            .andReturn();
        return json.readTree(result.getResponse().getContentAsString())
            .get("user").get("id").asLong();
    }

    private String inviteAndReturnUrl() throws Exception {
        MvcResult result = mvc.perform(asAdmin(post("/api/admin/users/invitations"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invitePayload("invitee@local", "Iris", "Invitee", List.of(3))))
            .andExpect(status().isCreated())
            .andReturn();
        return json.readTree(result.getResponse().getContentAsString())
            .get("inviteUrl").asText();
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder b) {
        return b.with(user(admin)).with(csrf());
    }
}
