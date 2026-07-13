package com.acme.estimator.clientpricing;

import com.acme.estimator.catalog.categories.Category;
import com.acme.estimator.catalog.categories.CategoryRepository;
import com.acme.estimator.clients.ClientRepository;
import com.acme.estimator.clientpricing.dto.CategoryPricingConfigDto;
import com.acme.estimator.clientpricing.dto.ClientPricingConfigDto;
import com.acme.estimator.clientpricing.dto.ClientPricingDefaultsDto;
import com.acme.estimator.clientpricing.dto.EffectivePricingDto;
import com.acme.estimator.clientpricing.dto.UpdateCategoryPricingRequest;
import com.acme.estimator.clientpricing.dto.UpdateClientPricingRequest;
import com.acme.estimator.clientpricing.dto.UpdateDefaultsRequest;
import com.acme.estimator.common.ApiException;
import java.math.BigDecimal;
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
    private final ClientPricingOverrideRepository clientOverrideRepo;
    private final CategoryRepository categoryRepo;
    private final ClientRepository clientRepo;

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

    /**
     * Category-only resolution (no client context) — used by the admin category
     * preview. Delegates to {@link #getEffectivePricing(Long, Long)} with a null
     * client.
     */
    @Transactional(readOnly = true)
    public EffectivePricingDto getEffectivePricingForCategory(Long categoryId) {
        return getEffectivePricing(categoryId, null);
    }

    /**
     * Resolves the effective pricing parameters for a category + client.
     * Precedence per field: <b>client override → category override → global
     * default</b> (most-specific wins; the client-level negotiated value beats a
     * generic category default). To change the precedence, reorder the arguments
     * to {@link #firstNonNull} below — that is the single source of truth.
     *
     * <p>The pricing MODEL is not part of the merge — it comes solely from the
     * category. Returns {@link EffectivePricingDto#none()} when the category has
     * no pricing model assigned or when {@code categoryId} is null.
     */
    @Transactional(readOnly = true)
    public EffectivePricingDto getEffectivePricing(Long categoryId, Long clientId) {
        if (categoryId == null) return EffectivePricingDto.none();
        Category category = categoryRepo.findById(categoryId).orElse(null);
        if (category == null || category.getPricingModel() == null) {
            return EffectivePricingDto.none();
        }
        ClientPricingDefaults defaults = loadDefaults();
        CategoryPricingOverride catOv = overrideRepo.findByCategoryId(categoryId).orElse(null);
        ClientPricingOverride cliOv = clientId == null
            ? null : clientOverrideRepo.findByClientId(clientId).orElse(null);

        return new EffectivePricingDto(
            category.getPricingModel(),
            firstNonNull(
                cliOv == null ? null : cliOv.getTmMultiplier(),
                catOv == null ? null : catOv.getTmMultiplier(),
                defaults.getTmMultiplier()),
            firstNonNull(
                cliOv == null ? null : cliOv.getTmTargetMarginPct(),
                catOv == null ? null : catOv.getTmTargetMarginPct(),
                defaults.getTmTargetMarginPct()),
            firstNonNull(
                cliOv == null ? null : cliOv.getMatBillableRate(),
                catOv == null ? null : catOv.getMatBillableRate(),
                defaults.getMatBillableRate()),
            firstNonNull(
                cliOv == null ? null : cliOv.getMatDiscountPct(),
                catOv == null ? null : catOv.getMatDiscountPct(),
                defaults.getMatDiscountPct())
        );
    }

    // ── Per-client overrides (client setup page) ─────────────────────────────

    /** This client's override values (null = inheriting) plus the global defaults. */
    @Transactional(readOnly = true)
    public ClientPricingConfigDto getClientPricing(Long clientId) {
        requireClient(clientId);
        ClientPricingOverride override = clientOverrideRepo.findByClientId(clientId).orElse(null);
        return ClientPricingConfigDto.of(clientId, override, ClientPricingDefaultsDto.from(loadDefaults()));
    }

    /** Upserts this client's override row. Null fields clear the override (inherit). */
    @Transactional
    public ClientPricingConfigDto updateClientPricing(
        Long clientId,
        UpdateClientPricingRequest req,
        Long actorId
    ) {
        requireClient(clientId);
        ClientPricingOverride override = clientOverrideRepo.findByClientId(clientId)
            .orElseGet(() -> {
                ClientPricingOverride ov = new ClientPricingOverride();
                ov.setClientId(clientId);
                return ov;
            });
        override.setTmMultiplier(req.overrideTmMultiplier());
        override.setTmTargetMarginPct(req.overrideTmTargetMarginPct());
        override.setMatBillableRate(req.overrideMatBillableRate());
        override.setMatDiscountPct(req.overrideMatDiscountPct());
        override.setUpdatedBy(actorId);
        clientOverrideRepo.save(override);
        return ClientPricingConfigDto.of(clientId, override, ClientPricingDefaultsDto.from(loadDefaults()));
    }

    private void requireClient(Long clientId) {
        if (clientId == null || !clientRepo.existsById(clientId)) {
            throw ApiException.notFound("Client not found.");
        }
    }

    /** Returns the first non-null value, or null if all are null. */
    private static BigDecimal firstNonNull(BigDecimal... values) {
        for (BigDecimal v : values) {
            if (v != null) return v;
        }
        return null;
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
