package com.acme.estimator.estimates.dto;

import java.util.List;

public record EstimateRequestAnswerView(
    Long questionId,
    String questionText,
    boolean required,
    boolean documentUploadEnabled,
    boolean documentUploadRequired,
    /** QuestionType name; drives which input control the wizard renders. */
    String questionType,
    /** Options for SINGLE_SELECT questions; empty otherwise. */
    List<String> options,
    String answerText,
    List<AttachmentMeta> attachments
) {}
