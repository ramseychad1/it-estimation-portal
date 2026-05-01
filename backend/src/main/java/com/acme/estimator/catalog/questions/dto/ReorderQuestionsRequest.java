package com.acme.estimator.catalog.questions.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ReorderQuestionsRequest(
    @NotEmpty List<Long> questionIds
) {}
