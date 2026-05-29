package com.acme.estimator.settings;

import com.acme.estimator.common.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import static com.acme.estimator.settings.AppSettingService.*;

@RestController
@RequestMapping("/api/admin/settings/gmail")
@RequiredArgsConstructor
public class GmailOAuthController {

    private static final String GMAIL_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String GMAIL_TOKEN_URL  = "https://oauth2.googleapis.com/token";
    private static final String GMAIL_SCOPE      = "https://www.googleapis.com/auth/gmail.send email";
    private static final String USERINFO_URL     = "https://www.googleapis.com/oauth2/v1/userinfo";

    // In-memory state store — admin-only flow, short-lived (5 min TTL)
    private static final Map<String, Long> pendingStates = new ConcurrentHashMap<>();

    private final AppSettingService settings;

    @Value("${app.backend-url:http://localhost:8080}")
    private String backendUrl;

    @Value("${app.base-url:http://localhost:5173}")
    private String frontendUrl;

    /** Returns the Google OAuth2 authorization URL for the admin to open. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/authorize")
    public Map<String, String> authorize() {
        String clientId = settings.getString(KEY_EMAIL_GMAIL_CLIENT_ID, "");
        if (clientId.isBlank()) {
            throw ApiException.badRequest("Gmail Client ID is not configured. Enter it in Global Settings first.");
        }

        String state = UUID.randomUUID().toString();
        pendingStates.put(state, System.currentTimeMillis());

        String redirectUri = buildRedirectUri();
        String authUrl = GMAIL_AUTH_URL
            + "?client_id="     + encode(clientId)
            + "&redirect_uri="  + encode(redirectUri)
            + "&response_type=code"
            + "&scope="         + encode(GMAIL_SCOPE)
            + "&access_type=offline"
            + "&prompt=consent"   // always returns refresh_token
            + "&state="         + state;

        return Map.of("authUrl", authUrl);
    }

    /**
     * Callback from Google after the admin approves the consent screen.
     * Exchanges the authorization code for tokens, stores the refresh token,
     * then redirects the browser back to the frontend settings page.
     * The admin's session cookie is carried through Google's redirect, so the
     * class-level hasRole('ADMIN') guard applies normally.
     */
    @GetMapping("/callback")
    public void callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            HttpServletResponse response) throws IOException {

        String settingsUrl = frontendUrl.replaceAll("/+$", "") + "/admin/settings";

        if (error != null || code == null) {
            response.sendRedirect(settingsUrl + "?gmail=error&reason=" + encode(error != null ? error : "no_code"));
            return;
        }

        Long issuedAt = pendingStates.remove(state);
        if (issuedAt == null || System.currentTimeMillis() - issuedAt > 300_000L) {
            response.sendRedirect(settingsUrl + "?gmail=error&reason=invalid_state");
            return;
        }

        try {
            String clientId     = settings.getString(KEY_EMAIL_GMAIL_CLIENT_ID, "");
            String clientSecret = settings.getString(KEY_EMAIL_GMAIL_CLIENT_SECRET, "");
            String redirectUri  = buildRedirectUri();

            // Exchange authorization code for tokens
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("code",          code);
            params.add("client_id",     clientId);
            params.add("client_secret", clientSecret);
            params.add("redirect_uri",  redirectUri);
            params.add("grant_type",    "authorization_code");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            ResponseEntity<Map<String, Object>> tokenResp = new RestTemplate().exchange(
                GMAIL_TOKEN_URL, HttpMethod.POST,
                new HttpEntity<>(params, headers),
                new org.springframework.core.ParameterizedTypeReference<>() {}
            );

            Map<String, Object> tokenBody = tokenResp.getBody();
            if (tokenBody == null) {
                response.sendRedirect(settingsUrl + "?gmail=error&reason=empty_token_response");
                return;
            }
            String refreshToken = (String) tokenBody.get("refresh_token");
            String accessToken  = (String) tokenBody.get("access_token");

            if (refreshToken == null || refreshToken.isBlank()) {
                response.sendRedirect(settingsUrl + "?gmail=error&reason=no_refresh_token");
                return;
            }

            // Resolve which Gmail address was authorized
            HttpHeaders authHeaders = new HttpHeaders();
            authHeaders.setBearerAuth(accessToken);
            ResponseEntity<Map<String, Object>> userResp = new RestTemplate().exchange(
                USERINFO_URL, HttpMethod.GET,
                new HttpEntity<>(authHeaders),
                new org.springframework.core.ParameterizedTypeReference<>() {}
            );
            Map<String, Object> userBody = userResp.getBody();
            String connectedEmail = userBody != null ? (String) userBody.getOrDefault("email", "") : "";

            settings.setAll(Map.of(
                KEY_EMAIL_GMAIL_REFRESH_TOKEN,   refreshToken,
                KEY_EMAIL_GMAIL_CONNECTED_EMAIL, connectedEmail
            ));

            response.sendRedirect(settingsUrl + "?gmail=connected");
        } catch (Exception ex) {
            response.sendRedirect(settingsUrl + "?gmail=error&reason=" + encode(ex.getMessage()));
        }
    }

    /** Clears the stored Gmail authorization (refresh token + connected email). */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/disconnect")
    public void disconnect() {
        settings.setAll(Map.of(
            KEY_EMAIL_GMAIL_REFRESH_TOKEN,   "",
            KEY_EMAIL_GMAIL_CONNECTED_EMAIL, ""
        ));
    }

    // ---- helpers -------------------------------------------------------------

    private String buildRedirectUri() {
        return backendUrl.replaceAll("/+$", "") + "/api/admin/settings/gmail/callback";
    }

    private static String encode(String s) {
        return URLEncoder.encode(s == null ? "" : s, StandardCharsets.UTF_8);
    }
}
