package com.acme.estimator.security;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Phase 1 baseline:
 *  - Session-cookie auth (stateful sessions, IF_REQUIRED).
 *  - CSRF token in a non-HttpOnly cookie so the SPA can echo it via X-XSRF-TOKEN.
 *  - 401 (not 302/login redirect) for unauthenticated API calls — the SPA does the redirect.
 *  - Public: /api/health, /api/auth/login, /api/auth/csrf. Everything else under /api requires auth.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${COOKIE_SECURE:false}")
    private boolean cookieSecure;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // Default behaviour of CookieCsrfTokenRepository in Spring Security 6 sets the cookie
        // value to the *encoded* token, but the request matcher expects the raw token. Using
        // the raw-token request handler keeps the SPA-friendly "read XSRF-TOKEN cookie, send
        // X-XSRF-TOKEN header" pattern working without surprises.
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null);

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> {
                CookieCsrfTokenRepository csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();
                csrfRepo.setCookieCustomizer(cookie -> cookie.secure(cookieSecure).sameSite("Lax"));
                csrf.csrfTokenRepository(csrfRepo)
                    .csrfTokenRequestHandler(csrfHandler);
            })
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/health",
                    "/api/auth/login",
                    "/api/auth/csrf",
                    // Invite-accept flow has to be reachable without a session — the
                    // invitee doesn't have one yet.
                    "/api/auth/invitations/**"
                ).permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            )
            .logout(logout -> logout.disable())  // we expose POST /api/auth/logout in AuthController
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable());

        return http.build();
    }

    /**
     * CORS allow-list. Strictly speaking the production setup proxies
     * /api/* through nginx (same-origin from the browser's POV), so a
     * preflight never fires in normal use. We still configure CORS for:
     *
     * <ul>
     *   <li>Local dev: the Vite dev server on :5173 hits the backend
     *       on :8080 directly — different origin → preflight required.</li>
     *   <li>Defense-in-depth: if the nginx proxy ever breaks or someone
     *       points a tool at the backend domain directly, the allow-list
     *       still confines what other origins can talk to it.</li>
     * </ul>
     *
     * <p>Uses {@code setAllowedOriginPatterns} (not {@code setAllowedOrigins})
     * so the explicit Railway origin works alongside {@code allowCredentials=true}.
     * The non-pattern variant rejects pattern strings even when no wildcard is
     * present on some Spring versions — patterns is the safe default.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of(
            "https://frontend-production-4228.up.railway.app",
            "http://localhost:5173"
        ));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("X-XSRF-TOKEN"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cfg);
        return source;
    }
}
