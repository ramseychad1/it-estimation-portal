package com.acme.estimator.catalog.subfeatures;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SubFeatureControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private CriticalQuestionRepository questionRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        questionRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        changeLogRepository.deleteAll();
        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow());
    }

    // ---- security ----------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        mvc.perform(get("/api/catalog/products/" + p.getId() + "/sub-features"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void solutionOwner_canList() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        mvc.perform(get("/api/catalog/products/" + p.getId() + "/sub-features").with(user(estimator)))
            .andExpect(status().isOk());
    }

    // ---- create ------------------------------------------------------------

    @Test
    void create_underContainerProduct_returns201() throws Exception {
        Product p = createProduct("Has subs", ProductMode.CONTAINER);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/sub-features"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "Variant A", "description", "First variant"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Variant A"))
            .andExpect(jsonPath("$.productId").value(p.getId()))
            .andExpect(jsonPath("$.active").value(true));

        SubFeature s = subFeatureRepository
            .findByProductIdAndNameIgnoreCaseAndActiveTrue(p.getId(), "Variant A").orElseThrow();
        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SubFeature.ENTITY_TYPE, s.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.CREATED);
    }

    @Test
    void create_underAtomicProduct_returns400_invalidProductMode() throws Exception {
        Product p = createProduct("Atomic prod", ProductMode.ATOMIC);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/sub-features"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Won't stick"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("INVALID_PRODUCT_MODE"));
    }

    @Test
    void create_duplicateNameWithinSameProduct_returns409() throws Exception {
        Product p = createProduct("Has subs", ProductMode.CONTAINER);
        createSubFeature(p.getId(), "Existing", true);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/sub-features"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "existing"))))
            .andExpect(status().isConflict());
    }

    @Test
    void create_sameNameUnderDifferentProducts_isAllowed() throws Exception {
        Product a = createProduct("Product A", ProductMode.CONTAINER);
        Product b = createProduct("Product B", ProductMode.CONTAINER);
        createSubFeature(a.getId(), "Shared", true);

        mvc.perform(asAdmin(post("/api/catalog/products/" + b.getId() + "/sub-features"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Shared"))))
            .andExpect(status().isCreated());
    }

    // ---- update ------------------------------------------------------------

    @Test
    void patch_renameWithinProductCollidingActive_returns409() throws Exception {
        // Symmetric rename-collision check — same as the Product equivalent.
        // Active "Bar" + active "Foo" within the same product → renaming Foo
        // to Bar must fail.
        Product p = createProduct("Container", ProductMode.CONTAINER);
        createSubFeature(p.getId(), "Bar", true);
        SubFeature foo = createSubFeature(p.getId(), "Foo", true);

        mvc.perform(asAdmin(patch("/api/catalog/sub-features/" + foo.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Bar"))))
            .andExpect(status().isConflict());
    }

    @Test
    void patch_activeFlip_returns400() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        SubFeature s = createSubFeature(p.getId(), "Toggle me", true);

        mvc.perform(asAdmin(patch("/api/catalog/sub-features/" + s.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("active", false))))
            .andExpect(status().isBadRequest());
    }

    @Test
    void patch_changesNameAndDescription_writesTwoUpdatedRows() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        SubFeature s = createSubFeature(p.getId(), "Old", "Old desc");

        mvc.perform(asAdmin(patch("/api/catalog/sub-features/" + s.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "New", "description", "New desc"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("New"));

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SubFeature.ENTITY_TYPE, s.getId());
        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(ChangeLogEntry::getFieldName)
            .containsExactlyInAnyOrder("name", "description");
    }

    // ---- activate / deactivate / deactivate-then-recreate -----------------

    @Test
    void reactivate_whenSameNameAlreadyActiveInSameProduct_returns409() throws Exception {
        // Pins the contract: once a fresh active "Foo" exists in product P,
        // re-activating the original "Foo" in P must fail. Mirrors the
        // Products equivalent. The test exists not because we doubt the
        // service code works, but so a future refactor that drops the
        // collision check fails loudly here instead of silently corrupting
        // the active-name uniqueness rule.
        Product p = createProduct("Container", ProductMode.CONTAINER);
        SubFeature first = createSubFeature(p.getId(), "Foo", true);

        mvc.perform(asAdmin(post("/api/catalog/sub-features/" + first.getId() + "/deactivate")));
        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/sub-features"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Foo"))));

        mvc.perform(asAdmin(post("/api/catalog/sub-features/" + first.getId() + "/activate")))
            .andExpect(status().isConflict());
    }

    @Test
    void deactivateThenRecreate_sameNameWithinProduct_isAllowed() throws Exception {
        // Symmetric to the Products test — sub-feature scope. Deactivate
        // "Foo" within product P → create a fresh active "Foo" in P → both
        // rows persist with the second active.
        Product p = createProduct("Container", ProductMode.CONTAINER);
        SubFeature first = createSubFeature(p.getId(), "Foo", true);

        mvc.perform(asAdmin(post("/api/catalog/sub-features/" + first.getId() + "/deactivate")))
            .andExpect(status().isOk());

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/sub-features"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Foo"))))
            .andExpect(status().isCreated());

        List<SubFeature> rows = subFeatureRepository.findByProductIdOrderByName(p.getId()).stream()
            .filter(s -> "Foo".equalsIgnoreCase(s.getName()))
            .toList();
        assertThat(rows).hasSize(2);
        assertThat(rows.stream().filter(SubFeature::isActive).count()).isEqualTo(1);
    }

    // ---- delete ------------------------------------------------------------

    @Test
    void delete_wrongConfirmation_returns400() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        SubFeature s = createSubFeature(p.getId(), "Has name", true);

        mvc.perform(asAdmin(delete("/api/catalog/sub-features/" + s.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "wrong"))))
            .andExpect(status().isBadRequest());
        assertThat(subFeatureRepository.findById(s.getId())).isPresent();
    }

    @Test
    void delete_correctConfirmation_returns204_andSingleDeletedRow() throws Exception {
        Product p = createProduct("Container", ProductMode.CONTAINER);
        SubFeature s = createSubFeature(p.getId(), "Deletable", true);

        mvc.perform(asAdmin(delete("/api/catalog/sub-features/" + s.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "DELETABLE"))))
            .andExpect(status().isNoContent());

        assertThat(subFeatureRepository.findById(s.getId())).isEmpty();
        long deletedRows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SubFeature.ENTITY_TYPE, s.getId())
            .stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(deletedRows).isEqualTo(1);
    }

    // ---- helpers -----------------------------------------------------------

    private Product createProduct(String name, ProductMode mode) {
        Product p = new Product();
        p.setName(name);
        p.setMode(mode);
        p.setActive(true);
        p.setCreatedBy(admin.getUserId());
        p.setUpdatedBy(admin.getUserId());
        return productRepository.save(p);
    }

    private SubFeature createSubFeature(Long productId, String name, boolean active) {
        return createSubFeature(productId, name, null, active);
    }

    private SubFeature createSubFeature(Long productId, String name, String description) {
        return createSubFeature(productId, name, description, true);
    }

    private SubFeature createSubFeature(Long productId, String name, String description, boolean active) {
        SubFeature s = new SubFeature();
        s.setProductId(productId);
        s.setName(name);
        s.setDescription(description);
        s.setActive(active);
        s.setCreatedBy(admin.getUserId());
        s.setUpdatedBy(admin.getUserId());
        return subFeatureRepository.save(s);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
