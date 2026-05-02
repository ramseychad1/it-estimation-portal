package com.acme.estimator.estimates.dto;

public record EstimateRequestAnswerView(
    Long questionId,
    String questionText,
    boolean required,
    String answerText
) {}
