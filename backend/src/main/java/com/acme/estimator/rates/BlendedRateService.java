package com.acme.estimator.rates;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.auth.User;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.rates.dto.CreateRateRequest;
import java.time.LocalDate;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rate management. **No update or delete methods exist on this service.**
 * Every change is a new immutable row plus a CREATED change_log entry.
 *
 * Defended at multiple layers:
 *   - The entity has no application-side mutators called by code here.
 *   - The controller exposes no PATCH or DELETE routes.
 *   - This service only exposes reads + a single create method.
 */
@Service
@RequiredArgsConstructor
public class BlendedRateService {

    private final BlendedRateRepository rateRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public Optional<BlendedRate> getCurrentRate() {
        return rateRepository.findCurrentAsOf(LocalDate.now());
    }

    @Transactional(readOnly = true)
    public Optional<BlendedRate> getRateAsOf(LocalDate date) {
        return rateRepository.findCurrentAsOf(date);
    }

    @Transactional(readOnly = true)
    public Page<BlendedRate> getHistory(Pageable pageable) {
        return rateRepository.findAllByOrderByEffectiveDateDescCreatedAtDesc(pageable);
    }

    @Transactional(readOnly = true)
    public BlendedRate getById(Long id) {
        return rateRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Rate " + id + " not found"));
    }

    @Transactional
    public BlendedRate createRate(CreateRateRequest req, User actor) {
        if (!req.confirmationAcknowledged()) {
            throw ApiException.badRequest(
                "You must acknowledge that this change is permanent and audited."
            );
        }

        LocalDate today = LocalDate.now();
        if (req.effectiveDate().isBefore(today)) {
            // Past-dating only allowed on Day 1 (no rates yet) — afterwards
            // it would invent retroactive cost calculations we can't reason
            // about cleanly.
            if (rateRepository.count() > 0) {
                throw ApiException.badRequest(
                    "Effective date cannot be in the past once rates exist."
                );
            }
        }

        BlendedRate rate = new BlendedRate();
        rate.setOnshoreRate(req.onshoreRate());
        rate.setOffshoreRate(req.offshoreRate());
        rate.setEffectiveDate(req.effectiveDate());
        rate.setNote(blankToNull(req.note()));
        rate.setCreatedBy(actor.getId());
        BlendedRate saved = rateRepository.save(rate);

        auditService.recordCreated(BlendedRate.ENTITY_TYPE, saved.getId(), actor, null);
        return saved;
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
