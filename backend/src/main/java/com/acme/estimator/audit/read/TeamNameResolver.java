package com.acme.estimator.audit.read;

import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class TeamNameResolver implements EntityNameResolver {

    static final String DELETED = "Deleted team";

    private final TeamRepository teamRepository;

    @Override
    public String entityType() {
        return Team.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);
        teamRepository.findAllById(ids).forEach(t -> out.put(t.getId(), t.getName()));
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        return new HashSet<>(teamRepository.findIdsByNameContainingIgnoreCase(search));
    }
}
