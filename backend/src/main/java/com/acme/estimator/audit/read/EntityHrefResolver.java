package com.acme.estimator.audit.read;

import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.teams.Team;
import com.acme.estimator.users.UserService;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Maps an {@code entity_type} to the frontend route the "View entity →"
 * link should jump to.
 *
 * For Phase 4 every type lands on its admin list page; when Phase 5+ adds
 * Product / Sub-feature / Template detail pages this becomes a one-line
 * addition per type rather than a re-wiring of the read service.
 *
 * Returning {@code null} signals "no link" — the controller passes that
 * straight through and the UI hides the affordance. Hard-deleted entities
 * also return null, decided at a layer above this resolver
 * (see {@link ChangeLogReadService}).
 */
@Component
public class EntityHrefResolver {

    private final Map<String, String> hrefByType = Map.of(
        Team.ENTITY_TYPE, "/admin/teams",
        SdlcPhase.ENTITY_TYPE, "/admin/phases",
        BlendedRate.ENTITY_TYPE, "/admin/rates",
        UserService.ENTITY_TYPE, "/admin/users"
    );

    public String resolve(String entityType) {
        return hrefByType.get(entityType);
    }
}
