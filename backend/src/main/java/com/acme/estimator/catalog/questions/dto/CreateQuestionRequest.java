package com.acme.estimator.catalog.questions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateQuestionRequest(
    @NotBlank @Size(max = 4000) String questionText,
    @Size(max = 4000) String helpText,
    Boolean required,
    Boolean active
) {}
