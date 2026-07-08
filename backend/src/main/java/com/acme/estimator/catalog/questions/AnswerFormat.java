package com.acme.estimator.catalog.questions;

import java.math.BigDecimal;
import java.util.List;

/**
 * Per-type validation of a non-blank answer string against its question.
 * Lives next to {@link QuestionType} so the format rules and the type enum
 * evolve together; the estimates package calls this from answer-save and
 * submit paths.
 */
public final class AnswerFormat {

    /** Answers larger than this can't be a real number entry. */
    private static final BigDecimal NUMBER_LIMIT = new BigDecimal("999999999999");

    private AnswerFormat() {}

    /**
     * @param question the live question the answer targets
     * @param answerText a non-blank answer string
     * @return null when valid; otherwise a user-facing error message
     */
    public static String validate(CriticalQuestion question, String answerText) {
        String answer = answerText.trim();
        switch (question.getQuestionType()) {
            case YES_NO -> {
                if (!answer.equals("Yes") && !answer.equals("No")) {
                    return "Answer must be Yes or No.";
                }
            }
            case SINGLE_SELECT -> {
                List<String> options = QuestionOptions.parse(question.getOptionsJson());
                // A SINGLE_SELECT with no options is a misconfigured catalog
                // row; don't trap the requester's answer behind it.
                if (!options.isEmpty() && !options.contains(answer)) {
                    return "Answer must be one of the question's options.";
                }
            }
            case NUMBER -> {
                try {
                    BigDecimal value = new BigDecimal(answer);
                    if (value.abs().compareTo(NUMBER_LIMIT) > 0) {
                        return "Number is out of range.";
                    }
                } catch (NumberFormatException e) {
                    return "Answer must be a number.";
                }
            }
            case LONG_TEXT, SHORT_TEXT -> { /* any text is fine */ }
        }
        return null;
    }
}
