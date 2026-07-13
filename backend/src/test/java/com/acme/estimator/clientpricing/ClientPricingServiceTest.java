package com.acme.estimator.clientpricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.estimator.catalog.categories.Category;
import com.acme.estimator.catalog.categories.CategoryRepository;
import com.acme.estimator.clientpricing.dto.ClientPricingConfigDto;
import com.acme.estimator.clientpricing.dto.EffectivePricingDto;
import com.acme.estimator.clientpricing.dto.UpdateClientPricingRequest;
import com.acme.estimator.common.ApiException;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolution precedence for effective pricing: <b>client → category → global</b>,
 * per field, plus the per-client override CRUD. Seed data (data.sql) provides the
 * defaults singleton (id=1), categories 1–7 (no pricing model), and clients 1–2.
 */
@SpringBootTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional
class ClientPricingServiceTest {

    private static final long CATEGORY_ID = 7L; // "Test Category"
    private static final long CLIENT_ID = 2L;   // "Acme Corp"

    @Autowired private ClientPricingService service;
    @Autowired private ClientPricingDefaultsRepository defaultsRepo;
    @Autowired private CategoryPricingOverrideRepository categoryOverrideRepo;
    @Autowired private ClientPricingOverrideRepository clientOverrideRepo;
    @Autowired private CategoryRepository categoryRepo;

    @BeforeEach
    void setUp() {
        // Global defaults for all four params.
        ClientPricingDefaults d = defaultsRepo.findById(1L).orElseThrow();
        d.setTmMultiplier(bd("1.50"));
        d.setTmTargetMarginPct(bd("33.33"));
        d.setMatBillableRate(bd("200.00"));
        d.setMatDiscountPct(bd("0.00"));
        defaultsRepo.save(d);

        // Give the test category a pricing model (the model always comes from the category).
        Category cat = categoryRepo.findById(CATEGORY_ID).orElseThrow();
        cat.setPricingModel("TARGET_MARGIN");
        categoryRepo.save(cat);
    }

    // ---- precedence matrix (multiplier field) ----------------------------------

    @Test
    void neitherOverride_usesGlobalDefault() {
        EffectivePricingDto p = service.getEffectivePricing(CATEGORY_ID, CLIENT_ID);
        assertThat(p.tmMultiplier()).isEqualByComparingTo("1.50");
    }

    @Test
    void categoryOverrideOnly_usesCategory() {
        categoryOverride(bd("1.30"), null, null, null);
        EffectivePricingDto p = service.getEffectivePricing(CATEGORY_ID, CLIENT_ID);
        assertThat(p.tmMultiplier()).isEqualByComparingTo("1.30");
    }

    @Test
    void clientOverrideOnly_usesClient() {
        clientOverride(bd("1.20"), null, null, null);
        EffectivePricingDto p = service.getEffectivePricing(CATEGORY_ID, CLIENT_ID);
        assertThat(p.tmMultiplier()).isEqualByComparingTo("1.20");
    }

    @Test
    void bothOverrides_clientWins() {
        categoryOverride(bd("1.30"), null, null, null);
        clientOverride(bd("1.20"), null, null, null);
        EffectivePricingDto p = service.getEffectivePricing(CATEGORY_ID, CLIENT_ID);
        assertThat(p.tmMultiplier()).isEqualByComparingTo("1.20");
    }

    @Test
    void nullClientId_ignoresClientLayer() {
        clientOverride(bd("1.20"), null, null, null);
        categoryOverride(bd("1.30"), null, null, null);
        // No client context → category wins over global.
        EffectivePricingDto p = service.getEffectivePricing(CATEGORY_ID, null);
        assertThat(p.tmMultiplier()).isEqualByComparingTo("1.30");
    }

    // ---- per-field coalescing across all four params ---------------------------

    @Test
    void resolvesEachFieldIndependently() {
        // Client sets multiplier only; category sets margin only; the rest inherit global.
        clientOverride(bd("1.20"), null, null, null);
        categoryOverride(null, bd("25.00"), null, null);

        EffectivePricingDto p = service.getEffectivePricing(CATEGORY_ID, CLIENT_ID);
        assertThat(p.tmMultiplier()).isEqualByComparingTo("1.20");       // client
        assertThat(p.tmTargetMarginPct()).isEqualByComparingTo("25.00"); // category
        assertThat(p.matBillableRate()).isEqualByComparingTo("200.00");  // global
        assertThat(p.matDiscountPct()).isEqualByComparingTo("0.00");     // global
    }

    // ---- model + none() semantics ----------------------------------------------

    @Test
    void modelComesFromCategory() {
        EffectivePricingDto p = service.getEffectivePricing(CATEGORY_ID, CLIENT_ID);
        assertThat(p.pricingModel()).isEqualTo("TARGET_MARGIN");
    }

    @Test
    void categoryWithoutModel_returnsNone() {
        // Category 1 (RFP) has no pricing model seeded.
        EffectivePricingDto p = service.getEffectivePricing(1L, CLIENT_ID);
        assertThat(p.pricingModel()).isNull();
        assertThat(p.tmMultiplier()).isNull();
    }

    // ---- per-client override CRUD ----------------------------------------------

    @Test
    void getClientPricing_returnsOverrideAndDefaults() {
        clientOverride(bd("1.20"), null, null, null);
        ClientPricingConfigDto dto = service.getClientPricing(CLIENT_ID);
        assertThat(dto.clientId()).isEqualTo(CLIENT_ID);
        assertThat(dto.overrideTmMultiplier()).isEqualByComparingTo("1.20");
        assertThat(dto.defaults().tmMultiplier()).isEqualByComparingTo("1.50");
    }

    @Test
    void updateClientPricing_upsertsSingleRow() {
        service.updateClientPricing(CLIENT_ID, req("1.20"), 1L);
        service.updateClientPricing(CLIENT_ID, req("1.25"), 1L);
        assertThat(clientOverrideRepo.findByClientId(CLIENT_ID)).isPresent();
        assertThat(clientOverrideRepo.findAll()).hasSize(1);
        assertThat(service.getClientPricing(CLIENT_ID).overrideTmMultiplier())
            .isEqualByComparingTo("1.25");
    }

    @Test
    void updateClientPricing_thenResolves_appliesClientValue() {
        service.updateClientPricing(CLIENT_ID, req("1.10"), 1L);
        assertThat(service.getEffectivePricing(CATEGORY_ID, CLIENT_ID).tmMultiplier())
            .isEqualByComparingTo("1.10");
    }

    @Test
    void getClientPricing_unknownClient_throwsNotFound() {
        assertThatThrownBy(() -> service.getClientPricing(9999L))
            .isInstanceOf(ApiException.class);
    }

    // ---- helpers ---------------------------------------------------------------

    private static BigDecimal bd(String s) {
        return s == null ? null : new BigDecimal(s);
    }

    private UpdateClientPricingRequest req(String multiplier) {
        return new UpdateClientPricingRequest(bd(multiplier), null, null, null);
    }

    private void categoryOverride(BigDecimal mult, BigDecimal margin, BigDecimal rate, BigDecimal disc) {
        Category cat = categoryRepo.findById(CATEGORY_ID).orElseThrow();
        CategoryPricingOverride ov = new CategoryPricingOverride();
        ov.setCategory(cat);
        ov.setTmMultiplier(mult);
        ov.setTmTargetMarginPct(margin);
        ov.setMatBillableRate(rate);
        ov.setMatDiscountPct(disc);
        categoryOverrideRepo.save(ov);
    }

    private void clientOverride(BigDecimal mult, BigDecimal margin, BigDecimal rate, BigDecimal disc) {
        ClientPricingOverride ov = new ClientPricingOverride();
        ov.setClientId(CLIENT_ID);
        ov.setTmMultiplier(mult);
        ov.setTmTargetMarginPct(margin);
        ov.setMatBillableRate(rate);
        ov.setMatDiscountPct(disc);
        clientOverrideRepo.save(ov);
    }
}
