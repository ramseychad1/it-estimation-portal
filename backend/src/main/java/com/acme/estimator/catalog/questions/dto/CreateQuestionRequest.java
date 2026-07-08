package com.acme.estimator.catalog.questions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateQuestionRequest(
    @NotBlank @Size(max = 4000) String questionText,
    @Size(max = 4000) String helpText,
    Boolean required,
    Boolean active,
    Boolean documentUploadEnabled,
    Boolean documentUploadRequired,
    /** One of QuestionType; null defaults to LONG_TEXT. */
    String questionType,
    /** Only meaningful (and then required, min 2) for SINGLE_SELECT. */
    List<String> options
) {}
