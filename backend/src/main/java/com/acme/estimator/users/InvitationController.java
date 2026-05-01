package com.acme.estimator.users;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.users.dto.InvitationResult;
import com.acme.estimator.users.dto.InviteUserRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users/invitations")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class InvitationController {

    private final InvitationService invitationService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<InvitationResult> invite(
        @Valid @RequestBody InviteUserRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        InvitationResult result = invitationService.invite(body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/{userId}/resend")
    public InvitationResult resend(
        @PathVariable Long userId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return invitationService.resend(userId, currentUser(principal));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> revoke(
        @PathVariable Long userId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        invitationService.revoke(userId, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
