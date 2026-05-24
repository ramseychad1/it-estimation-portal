package com.acme.estimator.estimates;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.estimator.auth.Role;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateLine;
import com.acme.estimator.catalog.templates.EstimateTemplateLineRepository;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.AnswerInput;
import com.acme.estimator.estimates.dto.CreateDraftRequest;
import com.acme.estimator.estimates.dto.CreateItemRequest;
import com.acme.estimator.estimates.dto.EstimateRequestAnswerView;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.EstimateRequestItemDto;
import com.acme.estimator.estimates.dto.EstimateRequestPhaseLineView;
import com.acme.estimator.estimates.dto.SaveAnswersRequest;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Pins the snapshot semantics of {@link EstimateRequestService#submit}:
 *
 * <ul>
 *   <li>Template hour values are COPIED into the request item's own
 *       {@code estimate_request_phase_lines} rows.</li>
 *   <li>SDLC phase name + display order are SNAPSHOTTED at submission
 *       time and don't change when the phase is renamed/reordered later.</li>
 *   <li>Question text is SNAPSHOTTED into answer rows.</li>
 *   <li>Submission flips status to {@code SUBMITTED}, sets
 *       {@code submittedAt}, and sets {@code templateId} as the snapshot
 *       reference on the item.</li>
 *   <li>Subsequent template edits don't rewrite the snapshot.</li>
 * </ul>
 *
 * <p>Phase 9a: requests are now multi-item. All assertions check
 * {@code $.items[0]} — the first (and only) item in these single-product
 * tests.
 *
 * <p><b>Test-cleanup convention for {@code com.acme.estimator.estimates}.</b>
 * Tests in this package clean up their own rows in {@code @AfterEach}
 * because {@code estimate_request_items.product_id} and similar columns use
 * {@code ON DELETE RESTRICT} FKs. Other test classes' setUp() methods do
 * {@code productRepository.deleteAll()} unaware of the new tables; if
 * estimate_request rows leak across the shared @SpringBootTest H2 context,
 * those deleteAll() calls trip the RESTRICT constraint. Any new
 * estimate-request test must follow this convention or extract the cleanup
 * into a shared base class.
 */
@SpringBootTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EstimateRequestServiceSnapshotTest {

    @Autowired private EstimateRequestService service;
    @Autowired private EstimateRequestRepository requestRepository;
    @Autowired private EstimateRequestItemRepository itemRepository;
    @Autowired private EstimateRequestPhaseLineRepository phaseLineRepository;
    @Autowired private EstimateRequestQuestionAnswerRepository answerRepository;
    @Autowired private ProductRepository productRepository;
    @Autowired private SubFeatureRepository subFeatureRepository;
    @Autowired private CriticalQuestionRepository questionRepository;
    @Autowired private EstimateTemplateRepository templateRepository;
    @Autowired private EstimateTemplateLineRepository templateLineRepository;
    @Autowired private SdlcPhaseRepository phaseRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @PersistenceContext private EntityManager em;

    private User requester;

    @BeforeEach
    void setUp() {
        cleanAll();
        requester = ensureRequester();
    }

    @AfterEach
    void tearDown() {
        cleanAll();
    }

    private void cleanAll() {
        phaseLineRepository.deleteAll();
        answerRepository.deleteAll();
        itemRepository.deleteAll();
        requestRepository.deleteAll();
        templateLineRepository.deleteAll();
        templateRepository.deleteAll();
        questionRepository.deleteAll();
        subFeatureRepository.deleteAll();
        productRepository.deleteAll();
        phaseRepository.deleteAll();
        userRepository.findByEmailIgnoreCase("requester-snapshot-test@local")
            .ifPresent(userRepository::delete);
    }

    @Test
    void submit_copiesTemplateValuesAndSnapshotsPhaseMetadata() {
        SdlcPhase discovery = seedPhase("Discovery", 1);
        SdlcPhase build = seedPhase("Build", 2);
        Product product = seedAtomicProduct("Eligibility API");
        CriticalQuestion required = seedQuestion(product.getId(), "How many users?", true, 1);
        CriticalQuestion optional = seedQuestion(product.getId(), "Notes?", false, 2);
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, /*version*/ 3);
        seedTemplateLine(template.getId(), discovery.getId(), 10, 20, 30, 5, 10, 15);
        seedTemplateLine(template.getId(), build.getId(),     40, 80, 120, 20, 40, 60);

        EstimateRequestDetail draft = service.createDraft(
            new CreateDraftRequest("Member portal v2", "Background context", null, 1L, List.of(1L),
                1L, 1L, List.of(new CreateItemRequest(product.getId(), null, null)), "CATALOG"),
            requester
        );
        // Use first item id for answer save
        Long itemId = draft.items().get(0).id();
        service.saveDraftItemAnswers(
            draft.id(), itemId,
            new SaveAnswersRequest(List.of(
                new AnswerInput(required.getId(), "About 50,000"),
                new AnswerInput(optional.getId(), "")  // optional: blank → not persisted
            )),
            requester
        );

        EstimateRequestDetail submitted = service.submit(draft.id(), requester);

        // Derived status + item snapshot reference are set.
        assertThat(submitted.derivedStatus()).isEqualTo("SUBMITTED");
        assertThat(submitted.items()).hasSize(1);
        EstimateRequestItemDto item = submitted.items().get(0);
        assertThat(item.status()).isEqualTo(EstimateStatus.SUBMITTED);
        assertThat(item.submittedAt()).isNotNull();
        assertThat(item.templateId()).isEqualTo(template.getId());
        assertThat(item.templateVersionNumber()).isEqualTo(3);

        // Phase-line snapshots cover both phases, ordered by snapshot display order.
        assertThat(item.phaseLines()).hasSize(2);
        EstimateRequestPhaseLineView first = item.phaseLines().get(0);
        EstimateRequestPhaseLineView second = item.phaseLines().get(1);
        assertThat(first.sdlcPhaseName()).isEqualTo("Discovery");
        assertThat(first.displayOrder()).isEqualTo(1);
        assertThat(first.onshoreLow()).isEqualByComparingTo("10");
        assertThat(first.onshoreHigh()).isEqualByComparingTo("30");
        assertThat(first.offshoreHigh()).isEqualByComparingTo("15");
        assertThat(second.sdlcPhaseName()).isEqualTo("Build");
        assertThat(second.displayOrder()).isEqualTo(2);
        assertThat(second.onshoreLow()).isEqualByComparingTo("40");
        assertThat(second.onshoreHigh()).isEqualByComparingTo("120");
        assertThat(second.offshoreHigh()).isEqualByComparingTo("60");
        assertThat(first.onshoreOverride()).isNull();
        assertThat(second.offshoreOverride()).isNull();

        // Answers
        assertThat(item.answers()).hasSize(2);
        EstimateRequestAnswerView requiredView = item.answers().stream()
            .filter(a -> a.questionId().equals(required.getId())).findFirst().orElseThrow();
        EstimateRequestAnswerView optionalView = item.answers().stream()
            .filter(a -> a.questionId().equals(optional.getId())).findFirst().orElseThrow();
        assertThat(requiredView.answerText()).isEqualTo("About 50,000");
        assertThat(requiredView.questionText()).isEqualTo("How many users?");
        assertThat(optionalView.answerText()).isEmpty();
        assertThat(optionalView.required()).isFalse();

        // Mutate the live phase — snapshot must NOT change.
        SdlcPhase liveDiscovery = phaseRepository.findById(discovery.getId()).orElseThrow();
        liveDiscovery.setName("Inception");
        liveDiscovery.setDisplayOrder(99);
        phaseRepository.save(liveDiscovery);

        EstimateRequestDetail rehydrated = service.getMyRequest(submitted.id(), requester);
        assertThat(rehydrated.items().get(0).phaseLines().get(0).sdlcPhaseName()).isEqualTo("Discovery");
        assertThat(rehydrated.items().get(0).phaseLines().get(0).displayOrder()).isEqualTo(1);
    }

    @Test
    void submit_questionTextEditedBetweenSaveAndSubmit_snapshotsTheLatestText() {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility API");
        CriticalQuestion q = seedQuestion(product.getId(), "Original wording?", true, 1);
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);

        EstimateRequestDetail draft = service.createDraft(
            new CreateDraftRequest("R", null, null, 1L, List.of(1L),
                1L, 1L, List.of(new CreateItemRequest(product.getId(), null, null)), "CATALOG"),
            requester
        );
        Long itemId = draft.items().get(0).id();
        service.saveDraftItemAnswers(
            draft.id(), itemId,
            new SaveAnswersRequest(List.of(new AnswerInput(q.getId(), "Yes"))),
            requester
        );

        // SO edits the question text after the requester answered.
        CriticalQuestion live = questionRepository.findById(q.getId()).orElseThrow();
        live.setQuestionText("Refined wording?");
        live.setUpdatedBy(requester.getId());
        questionRepository.save(live);

        EstimateRequestDetail submitted = service.submit(draft.id(), requester);

        assertThat(submitted.items().get(0).answers()).hasSize(1);
        assertThat(submitted.items().get(0).answers().get(0).questionText()).isEqualTo("Refined wording?");

        // Post-submit edit should NOT propagate.
        live = questionRepository.findById(q.getId()).orElseThrow();
        live.setQuestionText("Even later wording?");
        questionRepository.save(live);

        EstimateRequestDetail rehydrated = service.getMyRequest(submitted.id(), requester);
        assertThat(rehydrated.items().get(0).answers().get(0).questionText()).isEqualTo("Refined wording?");
    }

    @Test
    void submit_withoutActiveTemplate_throwsNoActiveTemplate() {
        seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility API");
        // No template seeded.

        EstimateRequestDetail draft = service.createDraft(
            new CreateDraftRequest("R", null, null, 1L, List.of(1L),
                1L, 1L, List.of(new CreateItemRequest(product.getId(), null, null)), "CATALOG"),
            requester
        );

        assertThatThrownBy(() -> service.submit(draft.id(), requester))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> {
                ApiException api = (ApiException) ex;
                assertThat(api.getStatus().value()).isEqualTo(409);
                assertThat(api.getErrorCode()).isEqualTo("NO_ACTIVE_TEMPLATE");
                assertThat(api.getMessage()).contains("Eligibility API");
            });

        // Status must still be DRAFT (no items submitted).
        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(draft.id());
        assertThat(items.get(0).getStatus()).isEqualTo(EstimateStatus.DRAFT);
    }

    @Test
    void submit_missingRequiredAnswer_throwsAndPacksFieldErrors() {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product = seedAtomicProduct("Eligibility API");
        CriticalQuestion req = seedQuestion(product.getId(), "Required?", true, 1);
        EstimateTemplate template = seedActiveTemplate(product.getId(), null, 1);
        seedTemplateLine(template.getId(), phase.getId(), 1, 1, 1, 1, 1, 1);

        EstimateRequestDetail draft = service.createDraft(
            new CreateDraftRequest("R", null, null, 1L, List.of(1L),
                1L, 1L, List.of(new CreateItemRequest(product.getId(), null, null)), "CATALOG"),
            requester
        );
        Long itemId = draft.items().get(0).id();
        // Save a blank answer — service drops blanks, so equivalent to "no answer".
        service.saveDraftItemAnswers(
            draft.id(), itemId,
            new SaveAnswersRequest(List.of(new AnswerInput(req.getId(), ""))),
            requester
        );

        assertThatThrownBy(() -> service.submit(draft.id(), requester))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> {
                ApiException api = (ApiException) ex;
                assertThat(api.getStatus().value()).isEqualTo(400);
                assertThat(api.getErrorCode()).isEqualTo("MISSING_REQUIRED_ANSWERS");
                assertThat(api.getFieldErrors()).containsKey("question:" + req.getId());
            });
    }

    @Test
    void submit_subFeatureSnapshot_resolvesFromSubFeatureTemplateNotProductTemplate() {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product container = seedContainerProduct("Container");
        SubFeature sub = seedSubFeature(container.getId(), "Variant A");
        EstimateTemplate subTemplate = seedActiveTemplate(null, sub.getId(), 1);
        seedTemplateLine(subTemplate.getId(), phase.getId(), 7, 7, 7, 7, 7, 7);

        EstimateRequestDetail draft = service.createDraft(
            new CreateDraftRequest("R", null, null, 1L, List.of(1L),
                1L, 1L, List.of(new CreateItemRequest(container.getId(), sub.getId(), null)), "CATALOG"),
            requester
        );
        EstimateRequestDetail submitted = service.submit(draft.id(), requester);

        assertThat(submitted.derivedStatus()).isEqualTo("SUBMITTED");
        assertThat(submitted.items().get(0).templateId()).isEqualTo(subTemplate.getId());
        assertThat(submitted.items().get(0).phaseLines().get(0).onshoreLow()).isEqualByComparingTo("7");
    }

    @Test
    void submit_multipleItems_eachGetIndependentSnapshot() {
        SdlcPhase phase = seedPhase("Discovery", 1);
        Product product1 = seedAtomicProduct("Product Alpha");
        Product product2 = seedAtomicProduct("Product Beta");
        EstimateTemplate template1 = seedActiveTemplate(product1.getId(), null, 1);
        EstimateTemplate template2 = seedActiveTemplate(product2.getId(), null, 2);
        seedTemplateLine(template1.getId(), phase.getId(), 10, 20, 30, 5, 10, 15);
        seedTemplateLine(template2.getId(), phase.getId(), 100, 200, 300, 50, 100, 150);

        EstimateRequestDetail draft = service.createDraft(
            new CreateDraftRequest("Multi-product", null, null, 1L, List.of(1L),
                1L, 1L, List.of(
                    new CreateItemRequest(product1.getId(), null, null),
                    new CreateItemRequest(product2.getId(), null, null)
                ), "CATALOG"),
            requester
        );
        assertThat(draft.items()).hasSize(2);

        EstimateRequestDetail submitted = service.submit(draft.id(), requester);

        assertThat(submitted.derivedStatus()).isEqualTo("SUBMITTED");
        assertThat(submitted.items()).hasSize(2);

        // Each item has its own independent phase lines snapshot.
        EstimateRequestItemDto item1 = submitted.items().get(0);
        EstimateRequestItemDto item2 = submitted.items().get(1);
        assertThat(item1.productId()).isEqualTo(product1.getId());
        assertThat(item1.phaseLines()).hasSize(1);
        assertThat(item1.phaseLines().get(0).onshoreLow()).isEqualByComparingTo("10");

        assertThat(item2.productId()).isEqualTo(product2.getId());
        assertThat(item2.phaseLines()).hasSize(1);
        assertThat(item2.phaseLines().get(0).onshoreLow()).isEqualByComparingTo("100");
    }

    // ---- helpers --------------------------------------------------------

    private SdlcPhase seedPhase(String name, int order) {
        SdlcPhase p = new SdlcPhase();
        p.setName(name);
        p.setDisplayOrder(order);
        p.setActive(true);
        p.setSystem(false);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return phaseRepository.save(p);
    }

    private Product seedAtomicProduct(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.ATOMIC);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private Product seedContainerProduct(String name) {
        Product p = new Product();
        p.setName(name);
        p.setMode(ProductMode.CONTAINER);
        p.setActive(true);
        p.setCreatedBy(1L);
        p.setUpdatedBy(1L);
        return productRepository.save(p);
    }

    private SubFeature seedSubFeature(Long productId, String name) {
        SubFeature s = new SubFeature();
        s.setProductId(productId);
        s.setName(name);
        s.setActive(true);
        s.setCreatedBy(1L);
        s.setUpdatedBy(1L);
        return subFeatureRepository.save(s);
    }

    private CriticalQuestion seedQuestion(Long productId, String text, boolean required, int order) {
        CriticalQuestion q = new CriticalQuestion();
        q.setProductId(productId);
        q.setQuestionText(text);
        q.setRequired(required);
        q.setDisplayOrder(order);
        q.setActive(true);
        q.setCreatedBy(1L);
        q.setUpdatedBy(1L);
        return questionRepository.save(q);
    }

    private EstimateTemplate seedActiveTemplate(Long productId, Long subFeatureId, int versionNumber) {
        EstimateTemplate t = new EstimateTemplate();
        t.setProductId(productId);
        t.setSubFeatureId(subFeatureId);
        t.setVersionNumber(versionNumber);
        t.setActive(true);
        t.setCreatedBy(1L);
        return templateRepository.save(t);
    }

    private void seedTemplateLine(
        Long templateId, Long phaseId,
        int onLow, int onMed, int onHigh, int offLow, int offMed, int offHigh
    ) {
        EstimateTemplateLine l = new EstimateTemplateLine();
        l.setTemplateId(templateId);
        l.setSdlcPhaseId(phaseId);
        l.setOnshoreLow(BigDecimal.valueOf(onLow));
        l.setOnshoreMed(BigDecimal.valueOf(onMed));
        l.setOnshoreHigh(BigDecimal.valueOf(onHigh));
        l.setOffshoreLow(BigDecimal.valueOf(offLow));
        l.setOffshoreMed(BigDecimal.valueOf(offMed));
        l.setOffshoreHigh(BigDecimal.valueOf(offHigh));
        templateLineRepository.save(l);
    }

    private User ensureRequester() {
        return userRepository.findByEmailIgnoreCase("requester-snapshot-test@local").orElseGet(() -> {
            Role requesterRole = em.find(Role.class, (short) 4);
            if (requesterRole == null) {
                throw new IllegalStateException("Requester role missing");
            }
            User u = new User();
            u.setEmail("requester-snapshot-test@local");
            u.setPasswordHash(passwordEncoder.encode("ChangeMe123!"));
            u.setFirstName("Test");
            u.setLastName("Requester");
            u.setActive(true);
            u.setRoles(new HashSet<>(List.of(requesterRole)));
            return userRepository.save(u);
        });
    }
}
