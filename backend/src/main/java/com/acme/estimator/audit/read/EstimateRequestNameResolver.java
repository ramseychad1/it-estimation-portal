package com.acme.estimator.audit.read;

import com.acme.estimator.estimates.EstimateRequest;
import com.acme.estimator.estimates.EstimateRequestRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The estimate request's display name in the change-log feed is its
 * {@code title} — the requester names it themselves at draft creation.
 * Discarded requests render as the {@link #DELETED} placeholder.
 */
@Component
@RequiredArgsConstructor
class EstimateRequestNameResolver implements EntityNameResolver {

    static final String DELETED = "Deleted estimate request";

    private final EstimateRequestRepository requestRepository;

    @Override
    public String entityType() {
        return EstimateRequest.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);
        requestRepository.findAllById(ids).forEach(req -> out.put(req.getId(), req.getTitle()));
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        // Estimate requests are private to their requester. Allowing a
        // change-log search to surface them by title would let one user
        // discover another's request titles via the audit feed. The
        // change-log viewer is admin-only today, so the surface is small,
        // but the privacy invariant is worth keeping intact.
        return Set.of();
    }
}
