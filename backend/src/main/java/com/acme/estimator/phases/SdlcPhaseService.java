package com.acme.estimator.phases;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.User;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.phases.dto.SdlcPhaseCreateRequest;
import com.acme.estimator.phases.dto.SdlcPhaseUpdateRequest;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SdlcPhaseService {

    private static final int REORDER_PARK_OFFSET = 10_000;

    private final SdlcPhaseRepository phaseRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final AuditService auditService;
    /**
     * All activation guards in the bean graph. Each can veto an
     * inactive→active transition by throwing
     * {@link com.acme.estimator.common.ApiException}. Spring injects
     * implementations via constructor (Lombok {@code @RequiredArgsConstructor})
     * — empty list when no guards are registered, which is fine.
     *
     * <p>Phase 5b's {@code TemplateActivationGuard} is the only impl
     * today. The hook lives here (not directly inlining a template-repo
     * call) so {@code phases/} stays oblivious to {@code catalog/}.
     */
    private final List<SdlcPhaseActivationGuard> activationGuards;

    public enum StatusFilter { ALL, ACTIVE, INACTIVE }

    @Transactional(readOnly = true)
    public List<SdlcPhase> list(StatusFilter status) {
        StatusFilter effective = status == null ? StatusFilter.ALL : status;
        List<SdlcPhase> all = phaseRepository.findAllByOrderByDisplayOrderAsc();
        return switch (effective) {
            case ALL -> all;
            case ACTIVE -> all.stream().filter(SdlcPhase::isActive).toList();
            case INACTIVE -> all.stream().filter(p -> !p.isActive()).toList();
        };
    }

    @Transactional(readOnly = true)
    public SdlcPhase get(Long id) {
        return phaseRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Phase " + id + " not found"));
    }

    @Transactional(readOnly = true)
    public List<ChangeLogEntry> history(Long id) {
        get(id);
        return changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(SdlcPhase.ENTITY_TYPE, id);
    }

    @Transactional
    public SdlcPhase create(SdlcPhaseCreateRequest req, User actor) {
        phaseRepository.findByNameIgnoreCase(req.name().trim()).ifPresent(existing -> {
            throw ApiException.conflict(
                "A phase named '" + existing.getName() + "' already exists."
            );
        });

        SdlcPhase phase = new SdlcPhase();
        phase.setName(req.name().trim());
        phase.setDescription(blankToNull(req.description()));
        phase.setActive(req.active() == null ? true : req.active());
        phase.setSystem(false);
        phase.setDisplayOrder(phaseRepository.findMaxDisplayOrder() + 1);
        phase.setCreatedBy(actor.getId());
        phase.setUpdatedBy(actor.getId());
        SdlcPhase saved = phaseRepository.save(phase);

        auditService.recordCreated(SdlcPhase.ENTITY_TYPE, saved.getId(), actor, null);
        return saved;
    }

    @Transactional
    public SdlcPhase update(Long id, SdlcPhaseUpdateRequest req, User actor) {
        SdlcPhase phase = get(id);

        if (req.active() != null && req.active() != phase.isActive()) {
            throw ApiException.badRequest(
                "Use POST /activate or /deactivate to change a phase's active status."
            );
        }

        if (req.name() != null && !req.name().trim().equalsIgnoreCase(phase.getName())) {
            phaseRepository.findByNameIgnoreCase(req.name().trim()).ifPresent(existing -> {
                if (!existing.getId().equals(phase.getId())) {
                    throw ApiException.conflict(
                        "A phase named '" + existing.getName() + "' already exists."
                    );
                }
            });
        }

        boolean dirty = false;

        if (req.name() != null) {
            String newName = req.name().trim();
            if (auditService.recordUpdated(
                SdlcPhase.ENTITY_TYPE, phase.getId(), "name", phase.getName(), newName, actor
            )) {
                phase.setName(newName);
                dirty = true;
            }
        }

        if (req.description() != null) {
            String newDescription = blankToNull(req.description());
            if (auditService.recordUpdated(
                SdlcPhase.ENTITY_TYPE, phase.getId(), "description",
                phase.getDescription(), newDescription, actor
            )) {
                phase.setDescription(newDescription);
                dirty = true;
            }
        }

        // ---- Benchmark fields (fractions; null = leave unchanged) -----------
        BigDecimal effLow = req.benchmarkLowPct() != null ? req.benchmarkLowPct() : phase.getBenchmarkLowPct();
        BigDecimal effHigh = req.benchmarkHighPct() != null ? req.benchmarkHighPct() : phase.getBenchmarkHighPct();
        if (effLow != null && effHigh != null && effLow.compareTo(effHigh) > 0) {
            throw ApiException.badRequest("Benchmark low % cannot exceed high %.");
        }

        dirty |= applyDecimal("benchmarkLowPct", phase.getBenchmarkLowPct(), req.benchmarkLowPct(),
            phase.getId(), phase::setBenchmarkLowPct, actor);
        dirty |= applyDecimal("benchmarkMidPct", phase.getBenchmarkMidPct(), req.benchmarkMidPct(),
            phase.getId(), phase::setBenchmarkMidPct, actor);
        dirty |= applyDecimal("benchmarkHighPct", phase.getBenchmarkHighPct(), req.benchmarkHighPct(),
            phase.getId(), phase::setBenchmarkHighPct, actor);
        dirty |= applyDecimal("defaultOffshorePct", phase.getDefaultOffshorePct(), req.defaultOffshorePct(),
            phase.getId(), phase::setDefaultOffshorePct, actor);

        if (req.devAnchor() != null && req.devAnchor() != phase.isDevAnchor()) {
            if (!req.devAnchor()) {
                throw ApiException.badRequest(
                    "Set another phase as the dev-hours anchor to move it — exactly one is required.");
            }
            // Moving the anchor here: clear it wherever it currently sits.
            for (SdlcPhase other : phaseRepository.findAllByOrderByDisplayOrderAsc()) {
                if (!other.getId().equals(phase.getId()) && other.isDevAnchor()) {
                    auditService.recordUpdated(SdlcPhase.ENTITY_TYPE, other.getId(),
                        "devAnchor", "true", "false", actor);
                    other.setDevAnchor(false);
                    other.setUpdatedBy(actor.getId());
                    phaseRepository.save(other);
                }
            }
            auditService.recordUpdated(SdlcPhase.ENTITY_TYPE, phase.getId(),
                "devAnchor", "false", "true", actor);
            phase.setDevAnchor(true);
            dirty = true;
        }

        if (dirty) {
            phase.setUpdatedBy(actor.getId());
            phaseRepository.save(phase);
        }
        return phase;
    }

    /**
     * Audits and applies a nullable benchmark BigDecimal. {@code null} means
     * "leave unchanged" (patch semantics). Comparison is numeric so a stored
     * "0.1500" and an incoming "0.15" aren't a spurious change.
     */
    private boolean applyDecimal(String field, BigDecimal oldVal, BigDecimal newVal, Long id,
                                 java.util.function.Consumer<BigDecimal> setter, User actor) {
        if (newVal == null || numEquals(oldVal, newVal)) {
            return false;
        }
        auditService.recordUpdated(SdlcPhase.ENTITY_TYPE, id, field, toStr(oldVal), toStr(newVal), actor);
        setter.accept(newVal);
        return true;
    }

    private static boolean numEquals(BigDecimal a, BigDecimal b) {
        if (a == null || b == null) return a == b;
        return a.compareTo(b) == 0;
    }

    private static String toStr(BigDecimal v) {
        return v == null ? null : v.toPlainString();
    }

    @Transactional
    public SdlcPhase activate(Long id, User actor) {
        SdlcPhase phase = get(id);
        // Already-active is a no-op; don't re-fire the guards on a phase
        // that's already in the desired state.
        if (phase.isActive()) return phase;

        // Run guards before flipping. Each may throw ApiException to veto.
        // Order is irrelevant for now (only one impl exists); first thrower
        // wins if multiple guards ever object to the same activation.
        for (SdlcPhaseActivationGuard guard : activationGuards) {
            guard.check(phase);
        }

        phase.setActive(true);
        phase.setUpdatedBy(actor.getId());
        phaseRepository.save(phase);
        auditService.recordActivated(SdlcPhase.ENTITY_TYPE, phase.getId(), actor);
        return phase;
    }

    @Transactional
    public SdlcPhase deactivate(Long id, User actor) {
        SdlcPhase phase = get(id);
        if (!phase.isActive()) return phase;
        phase.setActive(false);
        phase.setUpdatedBy(actor.getId());
        phaseRepository.save(phase);
        auditService.recordDeactivated(SdlcPhase.ENTITY_TYPE, phase.getId(), actor);
        return phase;
    }

    @Transactional
    public void delete(Long id, User actor) {
        SdlcPhase phase = get(id);
        if (phase.isSystem()) {
            throw ApiException.forbidden(
                "System phases cannot be deleted. Deactivate it instead."
            );
        }
        Long phaseId = phase.getId();
        phaseRepository.delete(phase);
        auditService.recordDeleted(SdlcPhase.ENTITY_TYPE, phaseId, actor, null);
    }

    /**
     * Two-pass reorder that works on both Postgres (with the deferrable
     * unique constraint) and H2 (without). Pass 1 parks every phase at
     * (REORDER_PARK_OFFSET + currentDisplayOrder) so we vacate the 1..N
     * range; pass 2 writes the final ordering. Each pass flushes before
     * the next, so the unique index on display_order never sees a duplicate.
     */
    @Transactional
    public List<SdlcPhase> reorder(List<Long> requestedOrder, User actor) {
        List<SdlcPhase> current = phaseRepository.findAllByOrderByDisplayOrderAsc();
        validateReorderRequest(requestedOrder, current);

        Map<Long, SdlcPhase> byId = new HashMap<>();
        Map<Long, Integer> oldOrders = new HashMap<>();
        for (SdlcPhase p : current) {
            byId.put(p.getId(), p);
            oldOrders.put(p.getId(), p.getDisplayOrder());
        }

        // Pass 1: park each phase at a high offset to free the 1..N range.
        for (SdlcPhase p : current) {
            p.setDisplayOrder(REORDER_PARK_OFFSET + p.getDisplayOrder());
        }
        phaseRepository.saveAllAndFlush(current);

        // Pass 2: write the final order.
        for (int i = 0; i < requestedOrder.size(); i++) {
            SdlcPhase p = byId.get(requestedOrder.get(i));
            int newOrder = i + 1;
            p.setDisplayOrder(newOrder);
            p.setUpdatedBy(actor.getId());
        }
        List<SdlcPhase> saved = phaseRepository.saveAllAndFlush(
            requestedOrder.stream().map(byId::get).toList()
        );

        // One REORDERED change_log row per phase whose display_order actually changed.
        for (SdlcPhase p : saved) {
            int oldOrder = oldOrders.get(p.getId());
            if (oldOrder != p.getDisplayOrder()) {
                auditService.recordReordered(
                    SdlcPhase.ENTITY_TYPE, p.getId(), oldOrder, p.getDisplayOrder(), actor
                );
            }
        }
        return phaseRepository.findAllByOrderByDisplayOrderAsc();
    }

    // ---- helpers --------------------------------------------------------

    private void validateReorderRequest(List<Long> requested, List<SdlcPhase> current) {
        Set<Long> currentIds = new HashSet<>();
        for (SdlcPhase p : current) currentIds.add(p.getId());

        Set<Long> requestedSet = new HashSet<>(requested);
        if (requested.size() != requestedSet.size()) {
            throw ApiException.badRequest("Reorder list contains duplicate phase ids.");
        }
        if (!currentIds.equals(requestedSet)) {
            throw ApiException.badRequest(
                "Reorder list must contain exactly the current set of phase ids."
            );
        }
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
