package com.acme.estimator.dashboard;

import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.audit.read.ChangeLogLabels;
import com.acme.estimator.audit.read.DescriptionFormatter;
import com.acme.estimator.audit.read.EntityHrefResolver;
import com.acme.estimator.audit.read.EntityNameResolver;
import com.acme.estimator.audit.read.UserNameResolver;
import com.acme.estimator.audit.read.dto.ChangeLogActorDto;
import com.acme.estimator.auth.InvitationStatus;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.dashboard.dto.ActivityFeedItem;
import com.acme.estimator.dashboard.dto.DashboardSummary;
import com.acme.estimator.dashboard.dto.StatCard;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.estimates.EstimateRequestItemRepository;
import com.acme.estimator.estimates.EstimateRequestRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import com.acme.estimator.common.PageLimits;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Composes the {@code /api/dashboard/*} responses out of existing
 * persistence — no new tables, no new state.
 *
 * <p>Two responsibilities:
 * <ol>
 *   <li><b>Summary cards</b> — counts a small, fixed set of metrics and
 *       returns only the cards the actor's roles unlock. Order is set
 *       here (matches the prompt) so the frontend doesn't re-sort.
 *   <li><b>Activity feed</b> — paginated permission-filtered slice of
 *       {@code change_log}, with the same description-formatting +
 *       href-resolution that powers the Change Log page. The dashboard
 *       intentionally does NOT collapse via the 2s-window grouping (see
 *       {@link ActivityFeedItem} javadoc) because it's a recency surface.
 * </ol>
 *
 * <p>Permission rules for the feed live in {@link ActivityFeedSpecifications}.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    /** Window for the {@code myRecentActivity} stat card. */
    static final java.time.Duration RECENT_ACTIVITY_WINDOW = java.time.Duration.ofDays(7);

    private final EstimateRequestRepository requestRepository;
    private final EstimateRequestItemRepository itemRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final ActivityFeedSpecifications visibility;
    private final EntityHrefResolver hrefResolver;
    private final List<EntityNameResolver> resolvers;

    private Map<String, EntityNameResolver> resolverByType;

    private Map<String, EntityNameResolver> resolverByType() {
        if (resolverByType == null) {
            Map<String, EntityNameResolver> map = new HashMap<>();
            for (EntityNameResolver r : resolvers) map.put(r.entityType(), r);
            resolverByType = Map.copyOf(map);
        }
        return resolverByType;
    }

    // ---- summary ----------------------------------------------------------

    @Transactional(readOnly = true)
    public DashboardSummary getSummary(User actor) {
        Long actorId = actor.getId();
        boolean isAdmin = actor.hasRole("Admin");
        boolean isSO = actor.hasRole("Solution Owner");

        List<StatCard> cards = new ArrayList<>(6);

        // SO-gated cards come first so review work is the most prominent
        // signal for an SO who's also a Requester (multi-role users see
        // their highest-stakes work at the top).
        if (isSO) {
            // Phase 9b M4: count items (not requests) in SUBMITTED status
            // from products belonging to the SO's teams. Admin sees all items.
            long awaitingReview;
            if (isAdmin) {
                awaitingReview = itemRepository.countAllSubmitted();
            } else {
                Set<Long> accessibleProductIds = soAccessibleProductIds(actorId);
                awaitingReview = accessibleProductIds.isEmpty()
                    ? 0L
                    : itemRepository.countSubmittedForProducts(accessibleProductIds);
            }
            cards.add(new StatCard(
                "awaitingReview",
                "Awaiting review",
                awaitingReview,
                "Submitted items assigned to your team"
            ));

            // Phase 9b M4: count items (not requests) in IN_REVIEW by this SO.
            long myActiveReviews = itemRepository.countInReviewByReviewer(actorId);
            cards.add(new StatCard(
                "myActiveReviews",
                "My active reviews",
                myActiveReviews,
                "Items you're currently reviewing"
            ));
        }

        // myDrafts is shown to everyone — even non-Requesters can have
        // started drafts (the dev seed gives admin@local both Admin and
        // Requester). The card returning 0 for someone who never drafts
        // is harmless and consistent.
        long myDrafts = requestRepository.countDraftsByRequesterId(actorId);
        cards.add(new StatCard(
            "myDrafts",
            "My drafts",
            myDrafts,
            "Estimate requests you started but haven't submitted"
        ));

        // Phase 9b M4: Requester "Needs revision" card — requests where at
        // least one item was rejected and is awaiting the requester's action.
        boolean isRequester = actor.hasRole("Requester");
        if (isRequester || isAdmin) {
            long needsRevision = requestRepository.countNeedsRevisionByRequesterId(actorId);
            cards.add(new StatCard(
                "needsRevision",
                "Needs revision",
                needsRevision,
                "Your requests with at least one rejected item"
            ));
        }

        if (isAdmin) {
            long pendingInvitations = userRepository
                .countByInvitationStatus(InvitationStatus.PENDING_INVITE);
            cards.add(new StatCard(
                "pendingInvitations",
                "Pending invitations",
                pendingInvitations,
                "Invitations sent but not yet accepted"
            ));

            long totalActiveUsers = userRepository
                .countByInvitationStatus(InvitationStatus.ACTIVE);
            cards.add(new StatCard(
                "totalActiveUsers",
                "Active users",
                totalActiveUsers,
                "Users who have accepted their invitations"
            ));
        }

        long myRecentActivity = changeLogRepository.countByChangedByAndChangedAtAfter(
            actorId,
            OffsetDateTime.now(ZoneOffset.UTC).minus(RECENT_ACTIVITY_WINDOW)
        );
        cards.add(new StatCard(
            "myRecentActivity",
            "My activity (7 days)",
            myRecentActivity,
            "Changes you made in the last week"
        ));

        return new DashboardSummary(cards);
    }

    /**
     * Product IDs accessible to an SO for review: products on their teams
     * plus products with no team assignment (permissive). Same logic as
     * {@code EstimateRequestService.requireTeamMembership}.
     */
    private Set<Long> soAccessibleProductIds(Long actorId) {
        Set<Long> teamIds = userRepository.findTeamIdsByUserId(actorId);
        Set<Long> teamProductIds = teamIds.isEmpty()
            ? Set.of()
            : productRepository.findIdsByTeamIdIn(teamIds);
        Set<Long> noTeamProductIds = productRepository.findIdsWithNullTeam();
        return Stream.concat(teamProductIds.stream(), noTeamProductIds.stream())
            .collect(Collectors.toSet());
    }

    // ---- activity feed ----------------------------------------------------

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<ActivityFeedItem> getActivity(
        boolean mineOnly, int page, int size, User actor
    ) {
        Specification<ChangeLogEntry> spec = visibility.visibleTo(actor);
        if (mineOnly) {
            spec = spec.and(visibility.onlyByActor(actor.getId()));
        }

        // Sort: changedAt DESC, then id DESC for a stable secondary key
        // when two rows share the same changedAt (audit grouping writes
        // multiple rows per second on burst updates).
        Sort sort = Sort.by(Sort.Direction.DESC, "changedAt").and(Sort.by(Sort.Direction.DESC, "id"));
        Pageable pageable = PageLimits.of(page, size, sort);

        Page<ChangeLogEntry> rows = changeLogRepository.findAll(spec, pageable);

        // Pre-resolve actor names + entity names per type — same batched
        // pattern as ChangeLogReadService. Avoids N+1 lookups per row.
        // When the page is empty the resolver maps stay empty too and the
        // map() lambda never fires.
        Map<Long, String> actorNames = resolveActorNames(rows.getContent());
        Map<String, Map<Long, String>> entityNamesByType = resolveEntityNames(rows.getContent());
        Map<String, Set<Long>> liveIdsByType = liveIdsByType(rows.getContent(), entityNamesByType);

        return rows.map(row -> toFeedItem(row, actorNames, entityNamesByType, liveIdsByType));
    }

    private ActivityFeedItem toFeedItem(
        ChangeLogEntry row,
        Map<Long, String> actorNames,
        Map<String, Map<Long, String>> entityNamesByType,
        Map<String, Set<Long>> liveIdsByType
    ) {
        String entityType = row.getEntityType();
        Long entityId = row.getEntityId();
        String entityName = entityNamesByType
            .getOrDefault(entityType, Map.of())
            .getOrDefault(entityId, "Unknown " + ChangeLogLabels.forEntityType(entityType));
        boolean entityDeleted = !liveIdsByType
            .getOrDefault(entityType, Set.of())
            .contains(entityId);

        String actorName = actorNames.getOrDefault(row.getChangedBy(), UserNameResolver.DELETED);
        String description = DescriptionFormatter.render(
            actorName, row.getChangedBy(), row.getAction(),
            entityType, entityId, entityName
        );
        String href = entityDeleted ? null : hrefResolver.resolve(entityType, entityId);

        return new ActivityFeedItem(
            row.getId(),
            row.getChangedAt(),
            new ChangeLogActorDto(row.getChangedBy(), actorName),
            description,
            entityType,
            href,
            ChangeLogLabels.forAction(row.getAction())
        );
    }

    private Map<Long, String> resolveActorNames(List<ChangeLogEntry> rows) {
        Set<Long> ids = rows.stream()
            .map(ChangeLogEntry::getChangedBy)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) {
            out.put(id, id == 0L ? UserNameResolver.SYSTEM : UserNameResolver.DELETED);
        }
        userRepository.findAllById(ids).forEach(u ->
            out.put(u.getId(), UserNameResolver.displayName(u))
        );
        return out;
    }

    private Map<String, Map<Long, String>> resolveEntityNames(List<ChangeLogEntry> rows) {
        Map<String, Set<Long>> idsByType = new HashMap<>();
        for (ChangeLogEntry r : rows) {
            idsByType.computeIfAbsent(r.getEntityType(), k -> new HashSet<>()).add(r.getEntityId());
        }
        Map<String, Map<Long, String>> out = new HashMap<>();
        idsByType.forEach((type, ids) -> {
            EntityNameResolver resolver = resolverByType().get(type);
            out.put(type, resolver == null ? Map.of() : resolver.resolveNames(ids));
        });
        return out;
    }

    /**
     * Distinguish "row exists" from "row was hard-deleted" so we can null
     * out the entityHref for deleted entities (the link would 404).
     * Same heuristic as ChangeLogReadService: a name starting with the
     * resolver's "Deleted ..." prefix means the id wasn't found.
     */
    private Map<String, Set<Long>> liveIdsByType(
        List<ChangeLogEntry> rows,
        Map<String, Map<Long, String>> namesByType
    ) {
        Map<String, Set<Long>> out = new HashMap<>();
        Map<String, Set<Long>> idsByType = new HashMap<>();
        for (ChangeLogEntry r : rows) {
            idsByType.computeIfAbsent(r.getEntityType(), k -> new HashSet<>()).add(r.getEntityId());
        }
        idsByType.forEach((type, ids) -> {
            Map<Long, String> names = namesByType.getOrDefault(type, Map.of());
            String prefix = "Deleted ";
            Set<Long> live = new HashSet<>();
            for (Long id : ids) {
                String name = names.get(id);
                // Resolvers return either the entity's name or a
                // "Deleted ..." placeholder. Treat anything not starting
                // with that placeholder prefix as live.
                if (name != null && !name.toLowerCase().startsWith(prefix.toLowerCase())) {
                    live.add(id);
                }
            }
            out.put(type, live);
        });
        return out;
    }
}
