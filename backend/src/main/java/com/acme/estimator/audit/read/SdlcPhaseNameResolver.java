package com.acme.estimator.audit.read;

import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.phases.SdlcPhaseRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class SdlcPhaseNameResolver implements EntityNameResolver {

    static final String DELETED = "Deleted phase";

    private final SdlcPhaseRepository phaseRepository;

    @Override
    public String entityType() {
        return SdlcPhase.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);
        phaseRepository.findAllById(ids).forEach(p -> out.put(p.getId(), p.getName()));
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        return new HashSet<>(phaseRepository.findIdsByNameContainingIgnoreCase(search));
    }
}
