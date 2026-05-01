package com.acme.estimator.catalog.templates;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.auth.User;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductMode;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.dto.CreateTemplateRequest;
import com.acme.estimator.catalog.templates.dto.SaveTemplateVersionRequest;
import com.acme.estimator.catalog.templates.dto.SaveTemplateVersionRequest.LineInput;
import com.acme.estimator.catalog.templates.dto.TemplateLineView;
import com.acme.estimator.catalog.templates.dto.TemplateView;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read + write side for estimate templates.
 *
 * <p><b>Immutability per version.</b> The service exposes only
 * {@link #getActiveForProduct}, {@link #getActiveForSubFeature},
 * {@link #createTemplate}, and {@link #saveNewVersion}. There is no
 * UPDATE path on either {@link EstimateTemplate} or
 * {@link EstimateTemplateLine} — every save creates a new template row,
 * flips the previous active to {@code is_active = false}, and inserts a
 * fresh batch of lines, all in a single transaction. Audit trail is
 * captured as a {@code CREATED} change_log row at {@code
 * entity_type = EstimateTemplate}; the chain of CREATED rows IS the
 * version history.
 *
 * <p><b>Phase reconciliation rule on PUT.</b> The body must include
 * exactly the union of:
 * <ul>
 *   <li>every currently-active SDLC phase, AND</li>
 *   <li>every phase the previous active version covered (which may now be
 *       inactive — those rows persist).</li>
 * </ul>
 * Anything missing or extra → {@code VALIDATION_ERROR}. The activation
 * guard at {@code SdlcPhaseService.activate} prevents new active phases
 * from sneaking in mid-cycle.
 */
@Service
@RequiredArgsConstructor
public class EstimateTemplateService {

    private final EstimateTemplateRepository templateRepository;
    private final EstimateTemplateLineRepository lineRepository;
    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;
    private final SdlcPhaseRepository phaseRepository;
    private final AuditService auditService;

    // ---- reads ---------------------------------------------------------

    @Transactional(readOnly = true)
    public Optional<TemplateView> getActiveForProduct(Long productId) {
        // 404 the product if it doesn't exist; null body if it exists but
        // has no template yet (Day 1).
        productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));
        return templateRepository.findActiveByProductId(productId).map(this::toView);
    }

    @Transactional(readOnly = true)
    public Optional<TemplateView> getActiveForSubFeature(Long subFeatureId) {
        subFeatureRepository.findById(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + subFeatureId + " not found"));
        return templateRepository.findActiveBySubFeatureId(subFeatureId).map(this::toView);
    }

    // ---- writes --------------------------------------------------------

    /**
     * Day-1 create: materialize one row per currently-active SDLC phase,
     * all hours = 0. Rejects when:
     *   - the target Product is CONTAINER (templates only on atomic);
     *   - an active template already exists for the parent.
     */
    @Transactional
    public TemplateView createForProduct(Long productId, CreateTemplateRequest req, User actor) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));
        if (product.getMode() != ProductMode.ATOMIC) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "INVALID_PRODUCT_MODE",
                "Templates can only be created on atomic products."
            );
        }
        templateRepository.findActiveByProductId(productId).ifPresent(existing -> {
            throw new ApiException(
                HttpStatus.CONFLICT,
                "ALREADY_EXISTS",
                "An active template already exists for this product."
            );
        });
        return create(/*productId*/ productId, /*subFeatureId*/ null, req, actor);
    }

    @Transactional
    public TemplateView createForSubFeature(Long subFeatureId, CreateTemplateRequest req, User actor) {
        subFeatureRepository.findById(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + subFeatureId + " not found"));
        templateRepository.findActiveBySubFeatureId(subFeatureId).ifPresent(existing -> {
            throw new ApiException(
                HttpStatus.CONFLICT,
                "ALREADY_EXISTS",
                "An active template already exists for this sub-feature."
            );
        });
        return create(null, subFeatureId, req, actor);
    }

    private TemplateView create(Long productId, Long subFeatureId, CreateTemplateRequest req, User actor) {
        EstimateTemplate template = new EstimateTemplate();
        template.setProductId(productId);
        template.setSubFeatureId(subFeatureId);
        template.setVersionNumber(1);
        template.setActive(true);
        template.setChangeReason(blankToNull(req.changeReason()));
        template.setCreatedBy(actor.getId());
        EstimateTemplate saved = templateRepository.save(template);

        // One line per currently-active phase, hours = 0.
        List<SdlcPhase> activePhases = phaseRepository.findAllByActiveTrueOrderByDisplayOrderAsc();
        List<EstimateTemplateLine> lines = new ArrayList<>(activePhases.size());
        for (SdlcPhase p : activePhases) {
            lines.add(buildLine(saved.getId(), p.getId(), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
        }
        lineRepository.saveAll(lines);

        auditService.recordCreated(EstimateTemplate.ENTITY_TYPE, saved.getId(), actor, null);
        return toView(saved);
    }

    /**
     * PUT — full-replacement save. Creates a NEW version (new row +
     * fresh lines), flips the previous active to inactive. Reconciles
     * the requested phase set against the previous version's phase set
     * plus any currently-active phases.
     */
    @Transactional
    public TemplateView saveNewVersionForProduct(
        Long productId, SaveTemplateVersionRequest req, User actor
    ) {
        productRepository.findById(productId)
            .orElseThrow(() -> ApiException.notFound("Product " + productId + " not found"));
        EstimateTemplate previous = templateRepository.findActiveByProductId(productId)
            .orElseThrow(() -> ApiException.badRequest(
                "No active template exists for this product yet — POST first to create one."
            ));
        return saveNewVersion(previous, productId, null, req, actor);
    }

    @Transactional
    public TemplateView saveNewVersionForSubFeature(
        Long subFeatureId, SaveTemplateVersionRequest req, User actor
    ) {
        subFeatureRepository.findById(subFeatureId)
            .orElseThrow(() -> ApiException.notFound("Sub-feature " + subFeatureId + " not found"));
        EstimateTemplate previous = templateRepository.findActiveBySubFeatureId(subFeatureId)
            .orElseThrow(() -> ApiException.badRequest(
                "No active template exists for this sub-feature yet — POST first to create one."
            ));
        return saveNewVersion(previous, null, subFeatureId, req, actor);
    }

    private TemplateView saveNewVersion(
        EstimateTemplate previous,
        Long productId,
        Long subFeatureId,
        SaveTemplateVersionRequest req,
        User actor
    ) {
        // ---- reconcile phase coverage --------------------------------
        Set<Long> previousPhaseIds = lineRepository.findAllByTemplateId(previous.getId())
            .stream().map(EstimateTemplateLine::getSdlcPhaseId).collect(Collectors.toSet());
        Set<Long> activePhaseIds = phaseRepository.findAllByActiveTrueOrderByDisplayOrderAsc()
            .stream().map(SdlcPhase::getId).collect(Collectors.toSet());
        Set<Long> expected = new HashSet<>(previousPhaseIds);
        expected.addAll(activePhaseIds); // currently-active that previous didn't have shouldn't happen (guard) but defend

        Set<Long> incoming = req.lines().stream()
            .map(LineInput::sdlcPhaseId).collect(Collectors.toSet());

        if (incoming.size() != req.lines().size()) {
            throw ApiException.badRequest("Duplicate sdlcPhaseId in request lines.");
        }
        Set<Long> missing = new HashSet<>(expected);
        missing.removeAll(incoming);
        Set<Long> extra = new HashSet<>(incoming);
        extra.removeAll(expected);
        if (!missing.isEmpty() || !extra.isEmpty()) {
            StringBuilder msg = new StringBuilder("Submitted lines must cover exactly the expected phases.");
            if (!missing.isEmpty()) msg.append(" Missing: ").append(missing).append(".");
            if (!extra.isEmpty())   msg.append(" Extra: ").append(extra).append(".");
            throw ApiException.badRequest(msg.toString());
        }

        // ---- flip previous, insert new -------------------------------
        previous.setActive(false);
        templateRepository.save(previous);

        int nextVersion = (productId != null
            ? templateRepository.maxVersionNumberForProduct(productId)
            : templateRepository.maxVersionNumberForSubFeature(subFeatureId)) + 1;

        EstimateTemplate next = new EstimateTemplate();
        next.setProductId(productId);
        next.setSubFeatureId(subFeatureId);
        next.setVersionNumber(nextVersion);
        next.setActive(true);
        next.setChangeReason(blankToNull(req.changeReason()));
        next.setCreatedBy(actor.getId());
        EstimateTemplate saved = templateRepository.save(next);

        List<EstimateTemplateLine> lines = new ArrayList<>(req.lines().size());
        for (LineInput in : req.lines()) {
            lines.add(buildLine(saved.getId(), in.sdlcPhaseId(),
                in.onshoreLow(), in.onshoreMed(), in.onshoreHigh(),
                in.offshoreLow(), in.offshoreMed(), in.offshoreHigh()));
        }
        lineRepository.saveAll(lines);

        auditService.recordCreated(EstimateTemplate.ENTITY_TYPE, saved.getId(), actor, null);
        return toView(saved);
    }

    // ---- helpers -------------------------------------------------------

    private TemplateView toView(EstimateTemplate t) {
        List<EstimateTemplateLine> lines =
            lineRepository.findAllByTemplateIdOrderBySdlcPhaseDisplayOrder(t.getId());

        // Batch-load phase metadata in one query.
        Set<Long> phaseIds = lines.stream()
            .map(EstimateTemplateLine::getSdlcPhaseId)
            .collect(Collectors.toSet());
        Map<Long, SdlcPhase> phasesById = new HashMap<>();
        phaseRepository.findAllById(phaseIds).forEach(p -> phasesById.put(p.getId(), p));

        List<TemplateLineView> lineViews = lines.stream().map(l -> {
            SdlcPhase p = phasesById.get(l.getSdlcPhaseId());
            return new TemplateLineView(
                l.getSdlcPhaseId(),
                p == null ? "(missing phase)" : p.getName(),
                p == null ? Integer.MAX_VALUE : p.getDisplayOrder(),
                p != null && p.isActive(),
                l.getOnshoreLow(), l.getOnshoreMed(), l.getOnshoreHigh(),
                l.getOffshoreLow(), l.getOffshoreMed(), l.getOffshoreHigh()
            );
        }).toList();

        return new TemplateView(
            t.getId(),
            t.getProductId(),
            t.getSubFeatureId(),
            t.getVersionNumber(),
            t.isActive(),
            t.getChangeReason(),
            t.getCreatedAt(),
            t.getCreatedBy(),
            displayName(t),
            lineViews
        );
    }

    /**
     * "Estimate template for {Parent name} — v{N}". Used by the
     * NameResolver in the change-log feed.
     */
    private String displayName(EstimateTemplate t) {
        String parentName;
        if (t.getProductId() != null) {
            parentName = productRepository.findById(t.getProductId())
                .map(Product::getName).orElse("Deleted product");
        } else if (t.getSubFeatureId() != null) {
            parentName = subFeatureRepository.findById(t.getSubFeatureId())
                .map(SubFeature::getName).orElse("Deleted sub-feature");
        } else {
            parentName = "(orphaned)";
        }
        return "Estimate template for " + parentName + " — v" + t.getVersionNumber();
    }

    private static EstimateTemplateLine buildLine(
        Long templateId, Long phaseId,
        BigDecimal onLow, BigDecimal onMed, BigDecimal onHigh,
        BigDecimal offLow, BigDecimal offMed, BigDecimal offHigh
    ) {
        EstimateTemplateLine line = new EstimateTemplateLine();
        line.setTemplateId(templateId);
        line.setSdlcPhaseId(phaseId);
        line.setOnshoreLow(onLow);
        line.setOnshoreMed(onMed);
        line.setOnshoreHigh(onHigh);
        line.setOffshoreLow(offLow);
        line.setOffshoreMed(offMed);
        line.setOffshoreHigh(offHigh);
        return line;
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
