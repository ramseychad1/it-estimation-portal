package com.acme.estimator.auth;

import com.acme.estimator.auth.dto.CurrentUserResponse;
import com.acme.estimator.auth.dto.LoginRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
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

    private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    @PostMapping("/login")
    public ResponseEntity<CurrentUserResponse> login(
            @Valid @RequestBody LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        Authentication unauth = UsernamePasswordAuthenticationToken.unauthenticated(body.email(), body.password());
        Authentication authed;
        try {
            authed = authenticationManager.authenticate(unauth);
        } catch (BadCredentialsException ex) {
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid email or password");
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

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me() {
        Authentication auth = contextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof AppUserDetails details)) {
            throw new ResponseStatusException(UNAUTHORIZED);
        }
        var teamIds = userRepository.findTeamIdsByUserId(details.getUserId());
        return ResponseEntity.ok(CurrentUserResponse.from(details, teamIds));
    }
}
