package com.acme.estimator.estimates.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record SaveAnswersRequest(
    @NotNull @Valid List<AnswerInput> answers
) {}
