package com.acme.estimator.audit.read;

import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.rates.BlendedRateRepository;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class BlendedRateNameResolver implements EntityNameResolver {

    /** Defensive only — rates are immutable + can't be deleted today. */
    static final String DELETED = "Blended rate (deleted)";

    private static final DateTimeFormatter EFFECTIVE_FORMAT =
        DateTimeFormatter.ofPattern("MMM d, yyyy");

    private final BlendedRateRepository rateRepository;

    @Override
    public String entityType() {
        return BlendedRate.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);
        rateRepository.findAllById(ids).forEach(r ->
            out.put(r.getId(), "Blended rate (" + EFFECTIVE_FORMAT.format(r.getEffectiveDate()) + ")")
        );
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        // Rates have a synthetic name ("Blended rate (May 1, 2026)") rather
        // than a stored name column. Searching against that string isn't a
        // real use case — users searching the change log don't type
        // "blended rate" or partial dates. Returning empty here means rate
        // rows are reachable via the Action / Date / Actor filters instead,
        // which is how a user would actually find them.
        return Set.of();
    }
}
