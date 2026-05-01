package com.acme.estimator.catalog.templates;

import com.acme.estimator.common.ApiException;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseActivationGuard;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Blocks SDLC phase activation when at least one active estimate
 * template exists. Auto-adding the new phase row to existing templates
 * would silently mutate audit-trailed data; we'd rather fail loudly and
 * have the SO update each template (creating a new version) before
 * flipping the phase live.
 *
 * <p>Error code: {@code TEMPLATES_WOULD_BE_AFFECTED} with
 * {@code affectedTemplateCount} in {@code fieldErrors} (the existing
 * structured-error slot). The frontend reads this and renders an info
 * modal — it's a non-destructive block, not a destructive confirmation.
 */
@Component
@RequiredArgsConstructor
public class TemplateActivationGuard implements SdlcPhaseActivationGuard {

    private final EstimateTemplateRepository templateRepository;

    @Override
    public void check(SdlcPhase phase) {
        long activeTemplates = templateRepository.countByActiveTrue();
        if (activeTemplates == 0) return;

        throw new ApiException(
            HttpStatus.CONFLICT,
            "TEMPLATES_WOULD_BE_AFFECTED",
            "Activating '" + phase.getName() + "' would affect "
                + activeTemplates + " active estimate template"
                + (activeTemplates == 1 ? "" : "s")
                + ". Update those templates to include this phase before activating.",
            Map.of("affectedTemplateCount", String.valueOf(activeTemplates))
        );
    }
}
