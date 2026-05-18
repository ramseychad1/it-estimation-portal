package com.acme.estimator.estimates.dto;

import java.util.List;

public record EstimateRequestAnswerView(
    Long questionId,
    String questionText,
    boolean required,
    boolean documentUploadEnabled,
    boolean documentUploadRequired,
    String answerText,
    List<AttachmentMeta> attachments
) {}
