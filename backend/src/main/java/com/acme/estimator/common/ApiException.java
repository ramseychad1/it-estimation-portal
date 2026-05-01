package com.acme.estimator.common;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Thrown by service code to signal a known business failure that should map
 * to a specific HTTP status and a typed error code (NOT_FOUND, CONFLICT,
 * FORBIDDEN, etc.). Handled by {@link GlobalExceptionHandler}.
 *
 * <p>{@code fieldErrors} is the structured-detail slot — same shape used
 * by request-validation errors. Useful for error codes that ship a count,
 * an offender id, or other machine-readable context (e.g.
 * {@code TEMPLATES_WOULD_BE_AFFECTED} → {@code {affectedTemplateCount: "3"}}).
 * {@code null} when no structured detail applies.
 */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, null);
    }

    public ApiException(
        HttpStatus status,
        String errorCode,
        String message,
        Map<String, String> fieldErrors
    ) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.fieldErrors = fieldErrors;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "CONFLICT", message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }
}
