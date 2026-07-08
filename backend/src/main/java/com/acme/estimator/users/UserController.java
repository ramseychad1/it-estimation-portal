package com.acme.estimator.users;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.InvitationStatus;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import com.acme.estimator.users.dto.DeleteUserRequest;
import com.acme.estimator.users.dto.ListUsersFilter;
import com.acme.estimator.users.dto.PasswordResetLinkResponse;
import com.acme.estimator.users.dto.UpdateUserRequest;
import com.acme.estimator.users.dto.UserDetail;
import com.acme.estimator.users.dto.UserHistoryItem;
import com.acme.estimator.users.dto.UserListItem;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    @GetMapping
    public PageResponse<UserListItem> list(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String role,
        @RequestParam(required = false) InvitationStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @RequestParam(defaultValue = "email,asc") String sort
    ) {
        ListUsersFilter filter = new ListUsersFilter(
            search,
            role == null || role.isBlank() ? null : Arrays.stream(role.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList(),
            status
        );
        Page<UserListItem> result = userService.list(filter, PageRequest.of(page, size, parseSort(sort)));
        // List-level meta: total active-admin count so the front-end's
        // last-admin banner doesn't depend on what's visible on this page.
        Map<String, Object> meta = Map.of("activeAdminCount", userRepository.countActiveAdmins());
        return PageResponse.from(result, u -> u, meta);
    }

    @GetMapping("/{id}")
    public UserDetail get(@PathVariable Long id) {
        return userService.getDetail(id);
    }

    @PatchMapping("/{id}")
    public UserDetail update(
        @PathVariable Long id,
        @Valid @RequestBody UpdateUserRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        User updated = userService.update(id, body, currentUser(principal));
        return UserDetail.from(updated, userService.loadUserTeams(updated.getId()));
    }

    @PostMapping("/{id}/activate")
    public UserDetail activate(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        User activated = userService.activate(id, currentUser(principal));
        return UserDetail.from(activated, userService.loadUserTeams(activated.getId()));
    }

    @PostMapping("/{id}/deactivate")
    public UserDetail deactivate(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        User deactivated = userService.deactivate(id, currentUser(principal));
        return UserDetail.from(deactivated, userService.loadUserTeams(deactivated.getId()));
    }

    @PostMapping("/{id}/reset-password")
    public PasswordResetLinkResponse resetPassword(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        // Returns the copy/paste reset link (SEC-1) — no plaintext password
        // is generated or logged.
        return userService.resetPassword(id, currentUser(principal));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @PathVariable Long id,
        @Valid @RequestBody DeleteUserRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        userService.delete(id, body, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/history")
    public List<UserHistoryItem> history(@PathVariable Long id) {
        return userService.history(id).stream().map(UserHistoryItem::from).toList();
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> export(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String role,
        @RequestParam(required = false) InvitationStatus status
    ) {
        ListUsersFilter filter = new ListUsersFilter(
            search,
            role == null || role.isBlank() ? null : Arrays.stream(role.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList(),
            status
        );
        List<User> users = userService.listAllForExport(filter);
        String filename = "users_export_" + LocalDate.now() + ".csv";
        StreamingResponseBody stream = out -> {
            try { UserCsvWriter.write(out, users); } catch (IOException e) { throw new IOException("CSV export failed", e); }
        };
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
            .body(stream);
    }

    // ---- helpers --------------------------------------------------------

    private User currentUser(AppUserDetails principal) {
        if (principal == null) {
            throw ApiException.forbidden("Authenticated user required");
        }
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }

    private Sort parseSort(String raw) {
        if (raw == null || raw.isBlank()) return Sort.by("email").ascending();
        String[] parts = raw.split(",", 2);
        Sort.Direction dir = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(dir, parts[0].trim());
    }
}
