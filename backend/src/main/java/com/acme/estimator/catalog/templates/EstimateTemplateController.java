package com.acme.estimator.catalog.templates;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.templates.dto.CreateTemplateRequest;
import com.acme.estimator.catalog.templates.dto.SaveTemplateVersionRequest;
import com.acme.estimator.catalog.templates.dto.TemplateView;
import com.acme.estimator.common.ApiException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Two parallel URL surfaces — one under a Product, one under a SubFeature
 * — both backed by {@link EstimateTemplateService}.
 *
 * <p>{@code GET} returns {@code null} body (HTTP 200) when no template
 * exists yet. {@code POST} creates the Day-1 template (server materializes
 * one row per active SDLC phase, hours = 0). {@code PUT} saves a new
 * version — every PUT creates a fresh row even when the body is unchanged.
 * Standard REST PUT idempotency intentionally doesn't apply; the endpoint
 * shape just maps cleanly to "save the desired state."
 */
@RestController
@PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")
@RequiredArgsConstructor
public class EstimateTemplateController {

    private final EstimateTemplateService templateService;
    private final UserRepository userRepository;

    // ---- under product -----------------------------------------------------

    @GetMapping("/api/catalog/products/{productId}/template")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REQUESTER')")
    public TemplateView getForProduct(@PathVariable Long productId) {
        return templateService.getActiveForProduct(productId).orElse(null);
    }

    @PostMapping("/api/catalog/products/{productId}/template")
    public ResponseEntity<TemplateView> createForProduct(
        @PathVariable Long productId,
        @Valid @RequestBody(required = false) CreateTemplateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        CreateTemplateRequest req = body == null ? new CreateTemplateRequest(null) : body;
        TemplateView created = templateService.createForProduct(productId, req, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/api/catalog/products/{productId}/template")
    public TemplateView saveForProduct(
        @PathVariable Long productId,
        @Valid @RequestBody SaveTemplateVersionRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return templateService.saveNewVersionForProduct(productId, body, currentUser(principal));
    }

    // ---- under sub-feature -------------------------------------------------

    @GetMapping("/api/catalog/sub-features/{subFeatureId}/template")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REQUESTER')")
    public TemplateView getForSubFeature(@PathVariable Long subFeatureId) {
        return templateService.getActiveForSubFeature(subFeatureId).orElse(null);
    }

    @PostMapping("/api/catalog/sub-features/{subFeatureId}/template")
    public ResponseEntity<TemplateView> createForSubFeature(
        @PathVariable Long subFeatureId,
        @Valid @RequestBody(required = false) CreateTemplateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        CreateTemplateRequest req = body == null ? new CreateTemplateRequest(null) : body;
        TemplateView created = templateService.createForSubFeature(subFeatureId, req, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/api/catalog/sub-features/{subFeatureId}/template")
    public TemplateView saveForSubFeature(
        @PathVariable Long subFeatureId,
        @Valid @RequestBody SaveTemplateVersionRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return templateService.saveNewVersionForSubFeature(subFeatureId, body, currentUser(principal));
    }

    // ---- helpers -----------------------------------------------------------

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
