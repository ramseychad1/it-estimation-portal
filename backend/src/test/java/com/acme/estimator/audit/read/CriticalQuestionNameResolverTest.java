package com.acme.estimator.audit.read;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Pure-logic tests for the word-boundary-aware truncation. */
class CriticalQuestionNameResolverTest {

    @Test
    void shortText_returnsAsIs() {
        assertThat(CriticalQuestionNameResolver.shorten("How many users?"))
            .isEqualTo("How many users?");
    }

    @Test
    void longText_truncatesAtWordBoundary() {
        // 80-char budget. This text is > 80 chars and ends mid-word at 80;
        // expect the cut at the last whole word with an ellipsis appended.
        String input =
            "How many users will use this product per day during peak business hours, approximately?";
        String out = CriticalQuestionNameResolver.shorten(input);

        assertThat(out).endsWith("…");
        assertThat(out.length()).isLessThanOrEqualTo(80);
        // Word boundary respected — should not slice "approximately?" mid-word.
        assertThat(out).doesNotContain("approximat…");
    }

    @Test
    void nullText_returnsPlaceholder() {
        assertThat(CriticalQuestionNameResolver.shorten(null)).isEqualTo("(empty)");
    }

    @Test
    void singleLongWord_fallsBackToRawCut() {
        // No whitespace in the budget at all → raw character cut. Better an
        // ugly truncation than an empty label.
        String input = "Lorem".repeat(50); // one ~250-char "word"
        String out = CriticalQuestionNameResolver.shorten(input);

        assertThat(out).endsWith("…");
        assertThat(out.length()).isLessThanOrEqualTo(80);
    }
}
