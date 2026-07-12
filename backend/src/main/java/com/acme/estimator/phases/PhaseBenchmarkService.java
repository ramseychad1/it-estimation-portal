package com.acme.estimator.phases;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.auth.User;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.phases.dto.PhaseBenchmarkRow;
import com.acme.estimator.phases.dto.PhaseBenchmarksResponse;
import com.acme.estimator.phases.dto.PhaseBenchmarksUpdateRequest;
import com.acme.estimator.settings.AppSettingService;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and writes the SDLC phase benchmark configuration that feeds the
 * dev-hours estimator: per-phase low/target/high distribution %, a default
 * offshore split, the single dev-anchor phase, and the global default
 * contingency %.
 *
 * <p>Benchmarks are mutable config, deliberately NOT versioned — generated
 * templates snapshot their own hours, so editing a benchmark never mutates a
 * historic template. The target-% sum is left to the client to warn on; the
 * server does not force it to 100% (the source model tolerates drift).
 */
@Service
@RequiredArgsConstructor
public class PhaseBenchmarkService {

    static final BigDecimal DEFAULT_CONTINGENCY = new BigDecimal("0.10");

    private final SdlcPhaseRepository phaseRepository;
    private final AppSettingService appSettingService;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public PhaseBenchmarksResponse get() {
        List<PhaseBenchmarkRow> rows = phaseRepository.findAllByOrderByDisplayOrderAsc()
            .stream().map(PhaseBenchmarkRow::from).toList();
        BigDecimal contingency = appSettingService.getBigDecimal(
            AppSettingService.KEY_DEFAULT_CONTINGENCY_PCT, DEFAULT_CONTINGENCY);
        return new PhaseBenchmarksResponse(contingency, rows);
    }

    @Transactional
    public PhaseBenchmarksResponse save(PhaseBenchmarksUpdateRequest req, User actor) {
        validate(req);

        Map<Long, SdlcPhase> byId = new LinkedHashMap<>();
        for (SdlcPhase p : phaseRepository.findAllByOrderByDisplayOrderAsc()) {
            byId.put(p.getId(), p);
        }

        for (PhaseBenchmarksUpdateRequest.Row row : req.phases()) {
            SdlcPhase phase = byId.get(row.id());
            if (phase == null) {
                throw ApiException.badRequest("Unknown phase id " + row.id() + ".");
            }
            boolean dirty = false;
            dirty |= applyDecimal(phase, "benchmarkLowPct",
                phase.getBenchmarkLowPct(), row.benchmarkLowPct(), phase::setBenchmarkLowPct, actor);
            dirty |= applyDecimal(phase, "benchmarkTargetPct",
                phase.getBenchmarkTargetPct(), row.benchmarkTargetPct(), phase::setBenchmarkTargetPct, actor);
            dirty |= applyDecimal(phase, "benchmarkHighPct",
                phase.getBenchmarkHighPct(), row.benchmarkHighPct(), phase::setBenchmarkHighPct, actor);
            dirty |= applyDecimal(phase, "defaultOffshorePct",
                phase.getDefaultOffshorePct(), row.defaultOffshorePct(), phase::setDefaultOffshorePct, actor);

            if (phase.isDevAnchor() != row.devAnchor()) {
                auditService.recordUpdated(SdlcPhase.ENTITY_TYPE, phase.getId(), "devAnchor",
                    String.valueOf(phase.isDevAnchor()), String.valueOf(row.devAnchor()), actor);
                phase.setDevAnchor(row.devAnchor());
                dirty = true;
            }

            if (dirty) {
                phase.setUpdatedBy(actor.getId());
                phaseRepository.save(phase);
            }
        }

        appSettingService.setAll(Map.of(
            AppSettingService.KEY_DEFAULT_CONTINGENCY_PCT, req.defaultContingencyPct().toPlainString()));

        return get();
    }

    // ---- helpers ------------------------------------------------------------

    private void validate(PhaseBenchmarksUpdateRequest req) {
        long anchors = req.phases().stream().filter(PhaseBenchmarksUpdateRequest.Row::devAnchor).count();
        if (anchors != 1) {
            throw ApiException.badRequest(
                "Exactly one phase must be the dev-hours anchor (got " + anchors + ").");
        }
        for (PhaseBenchmarksUpdateRequest.Row row : req.phases()) {
            BigDecimal low = row.benchmarkLowPct();
            BigDecimal high = row.benchmarkHighPct();
            if (low != null && high != null && low.compareTo(high) > 0) {
                throw ApiException.badRequest(
                    "Benchmark low % cannot exceed high % (phase id " + row.id() + ").");
            }
        }
    }

    /**
     * Audits and applies a nullable BigDecimal field. Returns true if the value
     * actually changed. Comparison is numeric ({@code compareTo}) so a stored
     * "0.1500" (NUMERIC(6,4) scale) and an incoming "0.15" don't register as a
     * spurious change on every save.
     */
    private boolean applyDecimal(SdlcPhase phase, String field, BigDecimal oldVal, BigDecimal newVal,
                                 java.util.function.Consumer<BigDecimal> setter, User actor) {
        if (numEquals(oldVal, newVal)) {
            return false;
        }
        auditService.recordUpdated(
            SdlcPhase.ENTITY_TYPE, phase.getId(), field, toStr(oldVal), toStr(newVal), actor);
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
}
