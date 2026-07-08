package com.acme.estimator.users;

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
import com.acme.estimator.auth.Role;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
// Tests mutate the seeded users (admin@local, estimator@local). @Transactional
// rolls back at the end of each test so subsequent tests still see them.
@Transactional
class UserControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private EntityManager em;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    private static final short ROLE_ID_ADMIN = 1;
    private static final short ROLE_ID_SO = 2;
    private static final short ROLE_ID_ESTIMATOR = 3;

    @BeforeEach
    void setUp() {
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow());
    }

    // ---- security ------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void nonAdmin_returns403_onListAndPatch() throws Exception {
        mvc.perform(get("/api/admin/users").with(user(estimator))).andExpect(status().isForbidden());
        mvc.perform(asUser(patch("/api/admin/users/1"), estimator)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isForbidden());
    }

    // ---- list ----------------------------------------------------------

    @Test
    void list_supportsSearchRoleAndStatusFilters() throws Exception {
        mvc.perform(get("/api/admin/users")
                .with(user(admin))
                .param("search", "estimator")
                .param("role", "Estimator"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].email").value("estimator@local"));

        mvc.perform(get("/api/admin/users").with(user(admin)).param("status", "ACTIVE"))
            .andExpect(jsonPath("$.totalElements").value(2));
    }

    // ---- update --------------------------------------------------------

    @Test
    void patch_singleField_writesOneUpdatedRow() throws Exception {
        Long id = estimator.getUserId();
        mvc.perform(asUser(patch("/api/admin/users/" + id), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("firstName", "Renamed"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.firstName").value("Renamed"));

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(UserService.ENTITY_TYPE, id);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.UPDATED);
        assertThat(rows.get(0).getFieldName()).isEqualTo("firstName");
    }

    @Test
    void patch_threeFieldsChanged_writesExactlyThreeUpdatedRows() throws Exception {
        Long id = estimator.getUserId();
        mvc.perform(asUser(patch("/api/admin/users/" + id), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "firstName", "Renamed",
                    "lastName", "User",
                    "email", "renamed@local"
                ))))
            .andExpect(status().isOk());

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(UserService.ENTITY_TYPE, id);
        assertThat(rows).hasSize(3);
        assertThat(rows).extracting(ChangeLogEntry::getFieldName)
            .containsExactlyInAnyOrder("firstName", "lastName", "email");
    }

    @Test
    void patch_emailToExistingEmail_returns409() throws Exception {
        mvc.perform(asUser(patch("/api/admin/users/" + estimator.getUserId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", "admin@local"))))
            .andExpect(status().isConflict());
    }

    // ---- last-admin protection ----------------------------------------

    @Test
    void patch_removingAdminFromOnlyAdmin_returns409_LAST_ADMIN_PROTECTION() throws Exception {
        // The seeded admin is the only Admin. Try to PATCH them with no Admin role.
        mvc.perform(asUser(patch("/api/admin/users/" + admin.getUserId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("roleIds", List.of((int) ROLE_ID_ESTIMATOR)))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("LAST_ADMIN_PROTECTION"));
    }

    @Test
    void deactivate_onOnlyAdmin_returns409() throws Exception {
        mvc.perform(asUser(post("/api/admin/users/" + admin.getUserId() + "/deactivate"), admin))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("LAST_ADMIN_PROTECTION"));
    }

    @Test
    void delete_onOnlyAdmin_returns409() throws Exception {
        mvc.perform(asUser(delete("/api/admin/users/" + admin.getUserId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "Local Admin"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("LAST_ADMIN_PROTECTION"));
    }

    @Test
    void afterAddingSecondAdmin_originalAdminCanBeDeactivated() throws Exception {
        // Promote estimator@local to Admin so the original admin is no longer the only one.
        mvc.perform(asUser(patch("/api/admin/users/" + estimator.getUserId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                    Map.of("roleIds", List.of((int) ROLE_ID_ADMIN, (int) ROLE_ID_SO, (int) ROLE_ID_ESTIMATOR))
                )))
            .andExpect(status().isOk());

        mvc.perform(asUser(post("/api/admin/users/" + admin.getUserId() + "/deactivate"), admin))
            .andExpect(status().isOk());
    }

    // ---- delete --------------------------------------------------------

    @Test
    void delete_wrongConfirmationName_returns400() throws Exception {
        mvc.perform(asUser(delete("/api/admin/users/" + estimator.getUserId()), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "Wrong Name"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    @Test
    void delete_correctConfirmationName_caseInsensitive_returns204_andWritesAuditRow() throws Exception {
        Long id = estimator.getUserId();
        mvc.perform(asUser(delete("/api/admin/users/" + id), admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "lOcAl eStImAtOr"))))
            .andExpect(status().isNoContent());

        assertThat(userRepository.findById(id)).isEmpty();
        var rows = changeLogRepository.findByEntityTypeAndEntityIdOrderByChangedAtDesc(
            UserService.ENTITY_TYPE, id);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.DELETED);
    }

    // ---- reset password -----------------------------------------------

    @Test
    void resetPassword_returnsLink_andWritesPasswordResetRow_noPlaintext() throws Exception {
        Long id = estimator.getUserId();
        String body = mvc.perform(asUser(post("/api/admin/users/" + id + "/reset-password"), admin))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.resetUrl").value(org.hamcrest.Matchers.containsString("/reset/")))
            .andExpect(jsonPath("$.expiresAt").exists())
            // SEC-1: the response must NOT contain a generated plaintext password.
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(jsonPath("$.newPassword").doesNotExist())
            .andReturn().getResponse().getContentAsString();

        var rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(UserService.ENTITY_TYPE, id);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.PASSWORD_RESET);

        // The link carries a real token that the public validate endpoint accepts.
        String token = body.substring(body.indexOf("/reset/") + "/reset/".length());
        token = token.substring(0, token.indexOf('"'));
        mvc.perform(get("/api/auth/password-resets/" + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(true));
    }

    @Test
    void resetPassword_thenComplete_setsNewPasswordWithoutOldPassword() throws Exception {
        Long id = estimator.getUserId();
        String token = mintResetToken(id);

        // No current-password field is sent — the whole point of an admin reset.
        mvc.perform(post("/api/auth/password-resets/" + token)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"BrandNewPass9\"}"))
            .andExpect(status().isNoContent());

        // Token is single-use: replaying it now fails.
        mvc.perform(post("/api/auth/password-resets/" + token)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"AnotherPass9\"}"))
            .andExpect(status().isBadRequest());

        // And it no longer validates.
        mvc.perform(get("/api/auth/password-resets/" + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false));
    }

    @Test
    void completeReset_rejectsWeakPassword() throws Exception {
        String token = mintResetToken(estimator.getUserId());
        mvc.perform(post("/api/auth/password-resets/" + token)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"short\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void validateReset_unknownToken_returnsInvalidWithoutLeakingEmail() throws Exception {
        mvc.perform(get("/api/auth/password-resets/does-not-exist"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void mintingNewResetToken_revokesThePrevious() throws Exception {
        Long id = estimator.getUserId();
        String first = mintResetToken(id);
        String second = mintResetToken(id);

        // The older link is now dead; only the newest works.
        mvc.perform(get("/api/auth/password-resets/" + first))
            .andExpect(jsonPath("$.valid").value(false));
        mvc.perform(get("/api/auth/password-resets/" + second))
            .andExpect(jsonPath("$.valid").value(true));
    }

    /** Issues a reset link as admin and returns the raw token from the URL. */
    private String mintResetToken(Long userId) throws Exception {
        String body = mvc.perform(asUser(post("/api/admin/users/" + userId + "/reset-password"), admin))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String token = body.substring(body.indexOf("/reset/") + "/reset/".length());
        return token.substring(0, token.indexOf('"'));
    }

    // ---- helpers -------------------------------------------------------

    /** Helper to add the Admin role to a user via direct repository write. */
    @SuppressWarnings("unused")
    private void addRole(Long userId, short roleId) {
        User u = userRepository.findById(userId).orElseThrow();
        Role r = em.find(Role.class, roleId);
        u.getRoles().add(r);
        userRepository.save(u);
    }

    private MockHttpServletRequestBuilder asUser(MockHttpServletRequestBuilder b, AppUserDetails who) {
        return b.with(user(who)).with(csrf());
    }
}
