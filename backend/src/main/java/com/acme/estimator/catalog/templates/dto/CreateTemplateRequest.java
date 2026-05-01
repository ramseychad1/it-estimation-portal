package com.acme.estimator.catalog.templates.dto;

import jakarta.validation.constraints.Size;

/**
 * Day-1 create. Body is intentionally tiny — the server materializes one
 * line per currently-active SDLC phase, all hours = 0. Only {@code
 * changeReason} is accepted, and it's optional ("Initial template" is the
 * implied note).
 */
public record CreateTemplateRequest(
    @Size(max = 4000) String changeReason
) {}
