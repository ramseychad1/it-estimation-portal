package com.acme.estimator.clientpricing;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.clientpricing.dto.CategoryPricingConfigDto;
import com.acme.estimator.clientpricing.dto.ClientPricingDefaultsDto;
import com.acme.estimator.clientpricing.dto.UpdateCategoryPricingRequest;
import com.acme.estimator.clientpricing.dto.UpdateDefaultsRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER')")
public class ClientPricingController {

    private final ClientPricingService service;

    @GetMapping("/api/admin/client-pricing/defaults")
    public ClientPricingDefaultsDto getDefaults() {
        return service.getDefaults();
    }

    @PutMapping("/api/admin/client-pricing/defaults")
    public ClientPricingDefaultsDto updateDefaults(
        @RequestBody UpdateDefaultsRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.updateDefaults(body, principal.getUserId());
    }

    @GetMapping("/api/admin/client-pricing/categories")
    public List<CategoryPricingConfigDto> listCategoryConfigs() {
        return service.listCategoryConfigs();
    }

    @PatchMapping("/api/admin/client-pricing/categories/{categoryId}")
    public CategoryPricingConfigDto updateCategoryPricing(
        @PathVariable Long categoryId,
        @RequestBody UpdateCategoryPricingRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.updateCategoryPricing(categoryId, body, principal.getUserId());
    }
}
