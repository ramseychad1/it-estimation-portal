package com.acme.estimator.catalog.questions;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * (De)serialization + validation for the {@code options_json} column on
 * {@link CriticalQuestion}. The column holds a plain JSON array of strings
 * ({@code ["Option A","Option B"]}) and is only meaningful for
 * SINGLE_SELECT questions.
 */
public final class QuestionOptions {

    public static final int MAX_OPTIONS = 50;
    public static final int MAX_OPTION_LENGTH = 200;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private QuestionOptions() {}

    /** Parse the stored JSON; null/blank/unparseable input yields an empty list. */
    public static List<String> parse(String optionsJson) {
        if (optionsJson == null || optionsJson.isBlank()) return List.of();
        try {
            return MAPPER.readValue(optionsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            // A malformed value can only get here by editing the DB by hand;
            // degrade to "no options" rather than 500 every read of the row.
            return List.of();
        }
    }

    public static String toJson(List<String> options) {
        if (options == null || options.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(options);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize question options", e);
        }
    }

    /**
     * Normalize (trim, drop blanks, dedupe preserving order) and validate an
     * incoming options list for a SINGLE_SELECT question.
     *
     * @return the normalized list
     * @throws IllegalArgumentException with a user-facing message when invalid
     */
    public static List<String> normalizeAndValidate(List<String> options) {
        Set<String> deduped = new LinkedHashSet<>();
        if (options != null) {
            for (String o : options) {
                if (o == null) continue;
                String trimmed = o.trim();
                if (trimmed.isEmpty()) continue;
                if (trimmed.length() > MAX_OPTION_LENGTH) {
                    throw new IllegalArgumentException(
                        "Options must be at most " + MAX_OPTION_LENGTH + " characters.");
                }
                deduped.add(trimmed);
            }
        }
        if (deduped.size() < 2) {
            throw new IllegalArgumentException(
                "Single select questions need at least 2 distinct options.");
        }
        if (deduped.size() > MAX_OPTIONS) {
            throw new IllegalArgumentException(
                "Single select questions allow at most " + MAX_OPTIONS + " options.");
        }
        return new ArrayList<>(deduped);
    }
}
