package com.acme.estimator.dashboard;

import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.auth.User;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.estimates.EstimateRequest;
import com.acme.estimator.estimates.EstimateRequestRepository;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.teams.Team;
import com.acme.estimator.users.UserService;
import jakarta.persistence.criteria.Predicate;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/**
 * Builds the {@link ChangeLogEntry} {@link Specification} that scopes the
 * dashboard activity feed to what the actor is permitted to see.
 *
 * <p>Three role buckets, with the same Specification surface but different
 * predicates:
 *
 * <ul>
 *   <li><b>Admin</b> — sees everything. The Specification is a no-op
 *       conjunction.
 *   <li><b>Solution Owner</b> — sees catalog + estimate-request +
 *       SDLC-phase + team + blended-rate rows, plus their own auth
 *       (User) actions. The point: SOs care about what's happening in the
 *       catalog and the review queue, not who got invited yesterday.
 *   <li><b>Requester</b> — sees only events on their own estimate
 *       requests, plus their own actions. They MUST NOT see other
 *       requesters' request titles or activity (matches the strict
 *       ownership-404 posture from Phase 6a).
 * </ul>
 *
 * <p>{@code mineOnly=true} is layered on top by the caller as a separate
 * AND predicate; this class just produces the visibility predicate.
 *
 * <p>Visibility lives here rather than on {@code ChangeLogReadService}
 * because the existing service is admin-only and didn't need to think
 * about per-role scoping. Colocating the dashboard's visibility rules
 * with the dashboard service keeps the audit-read package focused.
 */
@Component
@RequiredArgsConstructor
public class ActivityFeedSpecifications {

    /** Catalog + estimate-request + admin-config entity types an SO sees on /dashboard. */
    private static final Set<String> SO_VISIBLE_ENTITY_TYPES = Set.of(
        Product.ENTITY_TYPE,
        SubFeature.ENTITY_TYPE,
        CriticalQuestion.ENTITY_TYPE,
        EstimateTemplate.ENTITY_TYPE,
        EstimateRequest.ENTITY_TYPE,
        SdlcPhase.ENTITY_TYPE,
        Team.ENTITY_TYPE,
        BlendedRate.ENTITY_TYPE
    );

    private final EstimateRequestRepository requestRepository;

    /**
     * @param actor the authenticated user
     * @return a specification that ANDs in the role-based visibility rule.
     *         An admin-actor returns a no-op specification.
     */
    public Specification<ChangeLogEntry> visibleTo(User actor) {
        boolean isAdmin = actor.hasRole("Admin");
        boolean isSO = actor.hasRole("Solution Owner");

        if (isAdmin) {
            // Admins see the full feed. Use a no-op predicate so the
            // caller can still AND it with mineOnly etc.
            return (root, query, cb) -> cb.conjunction();
        }

        if (isSO) {
            return (root, query, cb) -> {
                Predicate inSoBucket = root.get("entityType").in(SO_VISIBLE_ENTITY_TYPES);
                // SOs also see their own auth actions (e.g. they accepted
                // their own invitation, reset their own password). Other
                // users' User-row events stay hidden — invitation activity
                // is admin business.
                Predicate ownAuthAction = cb.and(
                    cb.equal(root.get("entityType"), UserService.ENTITY_TYPE),
                    cb.equal(root.get("changedBy"), actor.getId())
                );
                return cb.or(inSoBucket, ownAuthAction);
            };
        }

        // Requester scope: own request events + own actions.
        // We resolve the requester's request ids up front (small, bounded
        // by user activity); a JPA subquery would also work but a Java
        // pre-fetch keeps the predicate simple and readable.
        Long actorId = actor.getId();
        List<Long> ownRequestIds = requestRepository
            .findByRequesterIdOrderByCreatedAtDesc(actorId,
                org.springframework.data.domain.Pageable.unpaged())
            .stream()
            .map(EstimateRequest::getId)
            .toList();

        return (root, query, cb) -> {
            Predicate ownActions = cb.equal(root.get("changedBy"), actorId);
            if (ownRequestIds.isEmpty()) {
                return ownActions;
            }
            Predicate ownRequestRows = cb.and(
                cb.equal(root.get("entityType"), EstimateRequest.ENTITY_TYPE),
                root.get("entityId").in(ownRequestIds)
            );
            return cb.or(ownActions, ownRequestRows);
        };
    }

    /** AND-able layer for the {@code mineOnly} toggle. */
    public Specification<ChangeLogEntry> onlyByActor(Long actorId) {
        return (root, query, cb) -> cb.equal(root.get("changedBy"), actorId);
    }
}
