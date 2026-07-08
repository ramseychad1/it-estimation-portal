package com.acme.estimator.catalog.questions;

/**
 * How the requester answers a critical question. Storage stays TEXT on the
 * answer row regardless of type — the type drives which input the wizard
 * renders and how the server validates the string:
 *
 *   LONG_TEXT      free-text textarea (pre-UX-2 default; all V36-migrated rows)
 *   SHORT_TEXT     single-line text input
 *   YES_NO         answer must be exactly "Yes" or "No"
 *   SINGLE_SELECT  answer must be one of the question's options
 *   NUMBER         answer must parse as a decimal
 *
 * Document upload is deliberately NOT a type — it stays orthogonal via the
 * documentUploadEnabled/Required flags so a question can ask for text AND
 * a file, exactly as before.
 */
public enum QuestionType {
    LONG_TEXT,
    SHORT_TEXT,
    YES_NO,
    SINGLE_SELECT,
    NUMBER
}
