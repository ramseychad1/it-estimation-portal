package com.acme.estimator.users;

import com.acme.estimator.users.dto.AcceptInviteRequest;
import com.acme.estimator.users.dto.AcceptInviteResult;
import com.acme.estimator.users.dto.ValidateTokenResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * No auth required. Reachable via the URL embedded in invite emails (or,
 * for now, the URL exposed in InvitationResult). Endpoints are added to
 * SecurityConfig's permitAll list.
 */
@RestController
@RequestMapping("/api/auth/invitations")
@RequiredArgsConstructor
public class PublicInvitationController {

    private final InvitationService invitationService;

    @GetMapping("/{token}")
    public ValidateTokenResponse validate(@PathVariable String token) {
        return invitationService.validate(token);
    }

    @PostMapping("/{token}/accept")
    public AcceptInviteResult accept(
        @PathVariable String token,
        @Valid @RequestBody AcceptInviteRequest body
    ) {
        return invitationService.accept(token, body);
    }
}
