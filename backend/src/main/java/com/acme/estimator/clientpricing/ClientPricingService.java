package com.acme.estimator.clientpricing;

import com.acme.estimator.catalog.categories.Category;
import com.acme.estimator.catalog.categories.CategoryRepository;
import com.acme.estimator.clientpricing.dto.CategoryPricingConfigDto;
import com.acme.estimator.clientpricing.dto.ClientPricingDefaultsDto;
import com.acme.estimator.clientpricing.dto.UpdateCategoryPricingRequest;
import com.acme.estimator.clientpricing.dto.UpdateDefaultsRequest;
import com.acme.estimator.common.ApiException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClientPricingService {

    private static final long DEFAULTS_ID = 1L;
    private static final String TARGET_MARGIN = "TARGET_MARGIN";
    private static final String TIME_AND_MATERIALS = "TIME_AND_MATERIALS";

    private final ClientPricingDefaultsRepository defaultsRepo;
    private final CategoryPricingOverrideRepository overrideRepo;
    private final CategoryRepository categoryRepo;

    @Transactional(readOnly = true)
    public ClientPricingDefaultsDto getDefaults() {
        return ClientPricingDefaultsDto.from(loadDefaults());
    }

    @Transactional
    public ClientPricingDefaultsDto updateDefaults(UpdateDefaultsRequest req, Long actorId) {
        ClientPricingDefaults defaults = loadDefaults();
        defaults.setTmMultiplier(req.tmMultiplier());
        defaults.setTmTargetMarginPct(req.tmTargetMarginPct());
        defaults.setMatBillableRate(req.matBillableRate());
        defaults.setMatDiscountPct(req.matDiscountPct());
        defaults.setUpdatedBy(actorId);
        return ClientPricingDefaultsDto.from(defaultsRepo.save(defaults));
    }

    @Transactional(readOnly = true)
    public List<CategoryPricingConfigDto> listCategoryConfigs() {
        List<Category> categories = categoryRepo.findAllByOrderByDisplayOrderAscNameAsc();

        Map<Long, CategoryPricingOverride> overrideMap = overrideRepo.findAllWithCategory()
            .stream()
            .collect(Collectors.toMap(o -> o.getCategory().getId(), o -> o));

        return categories.stream()
            .map(cat -> toConfigDto(cat, overrideMap.get(cat.getId())))
            .toList();
    }

    @Transactional
    public CategoryPricingConfigDto updateCategoryPricing(
        Long categoryId,
        UpdateCategoryPricingRequest req,
        Long actorId
    ) {
        Category category = categoryRepo.findById(categoryId)
            .orElseThrow(() -> ApiException.notFound("Category not found."));

        String model = req.pricingModel();
        if (model != null && !TARGET_MARGIN.equals(model) && !TIME_AND_MATERIALS.equals(model)) {
            throw ApiException.badRequest(
                "Invalid pricing model. Must be TARGET_MARGIN or TIME_AND_MATERIALS.");
        }
        category.setPricingModel(model);
        categoryRepo.save(category);

        CategoryPricingOverride override = overrideRepo.findByCategoryId(categoryId)
            .orElseGet(() -> {
                CategoryPricingOverride ov = new CategoryPricingOverride();
                ov.setCategory(category);
                return ov;
            });
        override.setTmMultiplier(req.overrideTmMultiplier());
        override.setTmTargetMarginPct(req.overrideTmTargetMarginPct());
        override.setMatBillableRate(req.overrideMatBillableRate());
        override.setMatDiscountPct(req.overrideMatDiscountPct());
        override.setUpdatedBy(actorId);
        overrideRepo.save(override);

        return toConfigDto(category, override);
    }

    private ClientPricingDefaults loadDefaults() {
        return defaultsRepo.findById(DEFAULTS_ID)
            .orElseThrow(() -> ApiException.notFound("Client pricing defaults not found."));
    }

    private static CategoryPricingConfigDto toConfigDto(Category cat, CategoryPricingOverride ov) {
        return new CategoryPricingConfigDto(
            cat.getId(),
            cat.getName(),
            cat.isActive(),
            cat.getPricingModel(),
            ov != null ? ov.getTmMultiplier() : null,
            ov != null ? ov.getTmTargetMarginPct() : null,
            ov != null ? ov.getMatBillableRate() : null,
            ov != null ? ov.getMatDiscountPct() : null
        );
    }
}
