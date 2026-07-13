package com.acme.estimator.clientpricing;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.clientpricing.dto.CategoryPricingConfigDto;
import com.acme.estimator.clientpricing.dto.ClientPricingConfigDto;
import com.acme.estimator.clientpricing.dto.ClientPricingDefaultsDto;
import com.acme.estimator.clientpricing.dto.EffectivePricingDto;
import com.acme.estimator.clientpricing.dto.UpdateCategoryPricingRequest;
import com.acme.estimator.clientpricing.dto.UpdateClientPricingRequest;
import com.acme.estimator.clientpricing.dto.UpdateDefaultsRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ClientPricingController {

    private final ClientPricingService service;

    // ── Read endpoints — Admin, Revenue Manager, Solution Owner ──────────────

    @GetMapping("/api/admin/client-pricing/defaults")
    @PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER','SOLUTION_OWNER')")
    public ClientPricingDefaultsDto getDefaults() {
        return service.getDefaults();
    }

    @GetMapping("/api/admin/client-pricing/categories")
    @PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER','SOLUTION_OWNER')")
    public List<CategoryPricingConfigDto> listCategoryConfigs() {
        return service.listCategoryConfigs();
    }

    /** This client's pricing override + the global defaults (for the client setup panel). */
    @GetMapping("/api/admin/client-pricing/clients/{clientId}")
    @PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER','SOLUTION_OWNER')")
    public ClientPricingConfigDto getClientPricing(@PathVariable Long clientId) {
        return service.getClientPricing(clientId);
    }

    /**
     * Effective pricing for a single category (overrides merged with defaults).
     * Used by the template editor and review screen to show per-item client price.
     */
    @GetMapping("/api/admin/client-pricing/categories/{categoryId}/effective")
    @PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER','SOLUTION_OWNER')")
    public EffectivePricingDto getEffectivePricing(@PathVariable Long categoryId) {
        return service.getEffectivePricingForCategory(categoryId);
    }

    // ── Write endpoints — Admin + Revenue Manager only ───────────────────────

    @PutMapping("/api/admin/client-pricing/defaults")
    @PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER')")
    public ClientPricingDefaultsDto updateDefaults(
        @Valid @RequestBody UpdateDefaultsRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.updateDefaults(body, principal.getUserId());
    }

    @PatchMapping("/api/admin/client-pricing/categories/{categoryId}")
    @PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER')")
    public CategoryPricingConfigDto updateCategoryPricing(
        @PathVariable Long categoryId,
        @Valid @RequestBody UpdateCategoryPricingRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.updateCategoryPricing(categoryId, body, principal.getUserId());
    }

    @PutMapping("/api/admin/client-pricing/clients/{clientId}")
    @PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER')")
    public ClientPricingConfigDto updateClientPricing(
        @PathVariable Long clientId,
        @Valid @RequestBody UpdateClientPricingRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.updateClientPricing(clientId, body, principal.getUserId());
    }
}
