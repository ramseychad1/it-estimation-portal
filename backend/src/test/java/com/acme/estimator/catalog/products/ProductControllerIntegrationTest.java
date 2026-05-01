package com.acme.estimator.catalog.products;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
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
class ProductControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private ProductRepository productRepository;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private CriticalQuestionRepository questionRepository;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private UserRepository userRepository;

    private AppUserDetails admin;
    private AppUserDetails estimator;

    @BeforeEach
    void setUp() {
        // Cascade-safe order: questions → sub_features → products. Postgres
        // would handle the cascade for us, but H2 doesn't always cascade
        // partial-unique indexes the same way, so be explicit.
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
        mvc.perform(get("/api/catalog/products"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void solutionOwner_canList() throws Exception {
        // estimator@local has Solution Owner + Estimator roles; SO grants access.
        mvc.perform(get("/api/catalog/products").with(user(estimator)))
            .andExpect(status().isOk());
    }

    // ---- list / filter -----------------------------------------------------

    @Test
    void list_filtersByModeAndStatusAndSearch() throws Exception {
        createProduct("Eligibility API", ProductMode.ATOMIC, true);
        createProduct("Enrollment Portal", ProductMode.CONTAINER, true);
        createProduct("Retired Tool", ProductMode.ATOMIC, false);

        mvc.perform(get("/api/catalog/products").with(user(admin))
                .param("mode", "ATOMIC"))
            .andExpect(jsonPath("$.totalElements").value(2));

        mvc.perform(get("/api/catalog/products").with(user(admin))
                .param("status", "ACTIVE"))
            .andExpect(jsonPath("$.totalElements").value(2));

        mvc.perform(get("/api/catalog/products").with(user(admin))
                .param("search", "portal"))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.items[0].name").value("Enrollment Portal"));
    }

    // ---- create ------------------------------------------------------------

    @Test
    void create_atomicProduct_returns201_andWritesCreatedRow() throws Exception {
        mvc.perform(asAdmin(post("/api/catalog/products"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "Eligibility API",
                    "description", "Real-time member eligibility lookup",
                    "mode", "ATOMIC"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Eligibility API"))
            .andExpect(jsonPath("$.mode").value("ATOMIC"))
            .andExpect(jsonPath("$.active").value(true));

        Product p = productRepository.findByNameIgnoreCaseAndActiveTrue("Eligibility API").orElseThrow();
        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, p.getId());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAction()).isEqualTo(ChangeAction.CREATED);
    }

    @Test
    void create_duplicateActiveName_returns409() throws Exception {
        createProduct("Already Here", ProductMode.ATOMIC, true);

        mvc.perform(asAdmin(post("/api/catalog/products"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "already here", "mode", "ATOMIC"
                ))))
            .andExpect(status().isConflict());
    }

    @Test
    void deactivateThenRecreate_sameName_isAllowed() throws Exception {
        // Locks in the active-name uniqueness scope: deactivate "Foo" → create
        // a fresh active "Foo" → both rows persist with the second active.
        // The DB-level partial-unique index is only present in Postgres; this
        // test asserts the service's behaviour matches the DB intent so the
        // Postgres-only constraint isn't surprising at deploy time.
        Product first = createProduct("Foo", ProductMode.ATOMIC, true);

        // Deactivate
        mvc.perform(asAdmin(post("/api/catalog/products/" + first.getId() + "/deactivate")))
            .andExpect(status().isOk());

        // Create a fresh active "Foo"
        mvc.perform(asAdmin(post("/api/catalog/products"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "Foo", "mode", "ATOMIC"
                ))))
            .andExpect(status().isCreated());

        // Both rows exist; the original is inactive, the new one is active.
        List<Product> rows = productRepository.findAll().stream()
            .filter(p -> "Foo".equalsIgnoreCase(p.getName()))
            .toList();
        assertThat(rows).hasSize(2);
        long active = rows.stream().filter(Product::isActive).count();
        long inactive = rows.stream().filter(p -> !p.isActive()).count();
        assertThat(active).isEqualTo(1);
        assertThat(inactive).isEqualTo(1);
    }

    @Test
    void reactivate_whenSameNameAlreadyActive_returns409() throws Exception {
        // Companion to deactivate-then-recreate: once a fresh active "Foo"
        // exists, re-activating the original "Foo" must fail.
        Product first = createProduct("Bar", ProductMode.ATOMIC, true);
        mvc.perform(asAdmin(post("/api/catalog/products/" + first.getId() + "/deactivate")));
        mvc.perform(asAdmin(post("/api/catalog/products"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Bar", "mode", "ATOMIC"))));

        mvc.perform(asAdmin(post("/api/catalog/products/" + first.getId() + "/activate")))
            .andExpect(status().isConflict());
    }

    // ---- update ------------------------------------------------------------

    @Test
    void patch_changesNameAndDescription_writesTwoUpdatedRows() throws Exception {
        Product p = createProduct("Old", ProductMode.ATOMIC, true, "Old desc");

        mvc.perform(asAdmin(patch("/api/catalog/products/" + p.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of(
                    "name", "New", "description", "New desc"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("New"))
            .andExpect(jsonPath("$.description").value("New desc"));

        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, p.getId());
        assertThat(rows).hasSize(2);
        assertThat(rows).allSatisfy(r -> assertThat(r.getAction()).isEqualTo(ChangeAction.UPDATED));
        assertThat(rows).extracting(ChangeLogEntry::getFieldName)
            .containsExactlyInAnyOrder("name", "description");
    }

    @Test
    void patch_renameCollidesWithExistingActive_returns409() throws Exception {
        // Locks in the symmetric rule: same uniqueness check that fires on
        // create must fire on rename. Easy to forget if the create path is
        // the only one tested.
        createProduct("Bar", ProductMode.ATOMIC, true);
        Product foo = createProduct("Foo", ProductMode.ATOMIC, true);

        mvc.perform(asAdmin(patch("/api/catalog/products/" + foo.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("name", "Bar"))))
            .andExpect(status().isConflict());
    }

    @Test
    void patch_modeChange_returns400_immutableField() throws Exception {
        Product p = createProduct("Lockedmode", ProductMode.ATOMIC, true);

        mvc.perform(asAdmin(patch("/api/catalog/products/" + p.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("mode", "CONTAINER"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("IMMUTABLE_FIELD"));
    }

    @Test
    void patch_activeFlip_returns400() throws Exception {
        Product p = createProduct("Toggle me", ProductMode.ATOMIC, true);

        mvc.perform(asAdmin(patch("/api/catalog/products/" + p.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("active", false))))
            .andExpect(status().isBadRequest());
    }

    // ---- activate / deactivate --------------------------------------------

    @Test
    void deactivate_writesDeactivatedRow() throws Exception {
        Product p = createProduct("Active product", ProductMode.ATOMIC, true);

        mvc.perform(asAdmin(post("/api/catalog/products/" + p.getId() + "/deactivate")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        assertThat(changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, p.getId()))
            .anyMatch(r -> r.getAction() == ChangeAction.DEACTIVATED);
    }

    // ---- delete ------------------------------------------------------------

    @Test
    void delete_wrongConfirmationName_returns400() throws Exception {
        Product p = createProduct("Has name", ProductMode.ATOMIC, true);

        mvc.perform(asAdmin(delete("/api/catalog/products/" + p.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "wrong"))))
            .andExpect(status().isBadRequest());
        assertThat(productRepository.findById(p.getId())).isPresent();
    }

    @Test
    void delete_correctConfirmationName_returns204_andSingleDeletedRow() throws Exception {
        Product p = createProduct("Deletable", ProductMode.ATOMIC, true);

        mvc.perform(asAdmin(delete("/api/catalog/products/" + p.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("confirmationName", "deletable"))))
            .andExpect(status().isNoContent());

        assertThat(productRepository.findById(p.getId())).isEmpty();
        List<ChangeLogEntry> rows = changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Product.ENTITY_TYPE, p.getId());
        long deletedRows = rows.stream().filter(r -> r.getAction() == ChangeAction.DELETED).count();
        assertThat(deletedRows).isEqualTo(1);
    }

    // ---- export ------------------------------------------------------------

    @Test
    void csvExport_includesUtf8Bom() throws Exception {
        createProduct("With, comma", ProductMode.ATOMIC, true);

        var asyncResult = mvc.perform(get("/api/catalog/products/export").with(user(admin)))
            .andExpect(request().asyncStarted())
            .andReturn();
        byte[] bytes = mvc.perform(asyncDispatch(asyncResult))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition",
                org.hamcrest.Matchers.containsString("products_export_")))
            .andExpect(content().contentTypeCompatibleWith("text/csv"))
            .andReturn().getResponse().getContentAsByteArray();

        assertThat(bytes[0]).isEqualTo((byte) 0xEF);
        assertThat(bytes[1]).isEqualTo((byte) 0xBB);
        assertThat(bytes[2]).isEqualTo((byte) 0xBF);
        String text = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        assertThat(text).contains("\"With, comma\"");
    }

    // ---- helpers -----------------------------------------------------------

    private Product createProduct(String name, ProductMode mode, boolean active) {
        return createProduct(name, mode, active, null);
    }

    private Product createProduct(String name, ProductMode mode, boolean active, String description) {
        Product p = new Product();
        p.setName(name);
        p.setDescription(description);
        p.setMode(mode);
        p.setActive(active);
        p.setCreatedBy(admin.getUserId());
        p.setUpdatedBy(admin.getUserId());
        return productRepository.save(p);
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder builder) {
        return builder.with(user(admin)).with(csrf());
    }
}
