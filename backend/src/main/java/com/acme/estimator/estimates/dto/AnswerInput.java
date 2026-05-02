package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * One question/answer pair on a Draft. Answer text is allowed to be blank
 * for OPTIONAL questions and required (non-blank) for REQUIRED questions —
 * the required-vs-optional rule is enforced server-side at submit time,
 * not in this DTO, because the same shape is used for both partial
 * "save as draft" and full "submit" flows.
 */
public record AnswerInput(
    @NotNull Long questionId,
    @Size(max = 8000) String answerText
) {}
