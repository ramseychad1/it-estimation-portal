package com.acme.estimator.auth;

import com.acme.estimator.auth.dto.ChangePasswordRequest;
import com.acme.estimator.auth.dto.CurrentUserResponse;
import com.acme.estimator.auth.dto.LoginRequest;
import com.acme.estimator.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoginThrottleService loginThrottle;

    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    @PostMapping("/login")
    public ResponseEntity<CurrentUserResponse> login(
            @Valid @RequestBody LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // SEC-4 / WEB-09: reject before authenticating if the account or the
        // client IP is locked out.
        String clientIp = clientIp(request);
        loginThrottle.assertNotLocked(body.email(), clientIp);

        Authentication unauth = UsernamePasswordAuthenticationToken.unauthenticated(body.email(), body.password());
        Authentication authed;
        try {
            authed = authenticationManager.authenticate(unauth);
        } catch (AuthenticationException ex) {
            // WEB-05: collapse every auth failure — bad credentials, disabled/
            // pending account, locked — into one generic response and count it
            // toward the throttle, so the response can't enumerate account state.
            loginThrottle.recordFailure(body.email(), clientIp);
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid email or password");
        }
        loginThrottle.recordSuccess(body.email());

        // WEB-06: rotate the session id on authentication to defeat session
        // fixation. Login is performed manually (no formLogin), so Spring's
        // SessionAuthenticationStrategy never runs — do it explicitly. Only a
        // pre-existing session can be fixated; a fresh one gets a new id anyway.
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }

        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(authed);
        contextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);

        AppUserDetails principal = (AppUserDetails) authed.getPrincipal();
        userRepository.findById(principal.getUserId()).ifPresent(u -> {
            u.setLastActiveAt(OffsetDateTime.now(ZoneOffset.UTC));
            userRepository.save(u);
        });
        var teamIds = userRepository.findTeamIdsByUserId(principal.getUserId());
        return ResponseEntity.ok(CurrentUserResponse.from(principal, teamIds));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        contextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest body,
            @AuthenticationPrincipal AppUserDetails principal
    ) {
        User user = userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.notFound("User not found."));
        if (!passwordEncoder.matches(body.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Current password is incorrect.");
        }
        user.setPasswordHash(passwordEncoder.encode(body.newPassword()));
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me() {
        Authentication auth = contextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserDetails details)) {
            throw new ResponseStatusException(UNAUTHORIZED);
        }
        var teamIds = userRepository.findTeamIdsByUserId(details.getUserId());
        return ResponseEntity.ok(CurrentUserResponse.from(details, teamIds));
    }

    /**
     * Best-effort client IP for per-IP throttling (WEB-09). Behind Railway the
     * real client IP is the leftmost {@code X-Forwarded-For} entry; falls back
     * to the direct peer for local/direct requests. Spoofable — see
     * {@link LoginThrottleService} for the trust caveat.
     */
    private static String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        return request.getRemoteAddr();
    }
}
