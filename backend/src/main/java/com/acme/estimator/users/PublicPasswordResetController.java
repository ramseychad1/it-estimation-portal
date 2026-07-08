package com.acme.estimator.users;

import com.acme.estimator.users.dto.CompletePasswordResetRequest;
import com.acme.estimator.users.dto.ValidateTokenResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * No auth required (SEC-1). Reachable via the copy/paste reset link an admin
 * hands to a user. Mirrors {@link PublicInvitationController}; paths are in
 * SecurityConfig's permitAll list.
 */
@RestController
@RequestMapping("/api/auth/password-resets")
@RequiredArgsConstructor
public class PublicPasswordResetController {

    private final UserService userService;

    @GetMapping("/{token}")
    public ValidateTokenResponse validate(@PathVariable String token) {
        return userService.validateResetToken(token);
    }

    @PostMapping("/{token}")
    public ResponseEntity<Void> complete(
        @PathVariable String token,
        @Valid @RequestBody CompletePasswordResetRequest body
    ) {
        userService.completePasswordReset(token, body);
        return ResponseEntity.noContent().build();
    }
}
