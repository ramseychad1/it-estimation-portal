package com.acme.estimator.audit.read;

import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class SubFeatureNameResolver implements EntityNameResolver {

    static final String DELETED = "Deleted sub-feature";

    private final SubFeatureRepository subFeatureRepository;

    @Override
    public String entityType() {
        return SubFeature.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);
        subFeatureRepository.findAllById(ids).forEach(s -> out.put(s.getId(), s.getName()));
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        return new HashSet<>(subFeatureRepository.findIdsByNameContainingIgnoreCase(search));
    }
}
