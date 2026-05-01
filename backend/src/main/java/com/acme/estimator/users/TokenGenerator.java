package com.acme.estimator.users;

import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Component;

/**
 * 32-byte URL-safe random tokens (43 char strings) for invitation links.
 * Single-source-of-truth so test code and production code agree on format.
 *
 * Tokens are opaque — never decoded — and stored verbatim in
 * invitation_tokens.token. NEVER log the raw value; debug logs may include
 * the first 8 characters via {@link #shortPrefix(String)}.
 */
@Component
public class TokenGenerator {

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String shortPrefix(String token) {
        if (token == null) return "(null)";
        return token.substring(0, Math.min(8, token.length())) + "…";
    }
}
