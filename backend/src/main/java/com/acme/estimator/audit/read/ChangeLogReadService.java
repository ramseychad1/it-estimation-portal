package com.acme.estimator.audit.read;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.audit.read.dto.ActionFilterOption;
import com.acme.estimator.audit.read.dto.ChangeLogActorDto;
import com.acme.estimator.audit.read.dto.ChangeLogChangeDto;
import com.acme.estimator.audit.read.dto.ChangeLogFilterOptions;
import com.acme.estimator.audit.read.dto.ChangeLogFilters;
import com.acme.estimator.audit.read.dto.ChangeLogGroupDto;
import com.acme.estimator.audit.read.dto.ChangeLogPageResponse;
import com.acme.estimator.audit.read.dto.EntityFilterOption;
import com.acme.estimator.audit.read.dto.UserFilterOption;
import com.acme.estimator.auth.UserRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-side of the change_log table.
 *
 * Two responsibilities:
 *  1. Translate {@link ChangeLogFilters} into a Spring Data Specification,
 *     including a two-pass search resolver (current entity / user names →
 *     ids → row predicate). The "current names" caveat is documented on
 *     {@link ChangeLogFilters}.
 *  2. Group raw rows into UI-shaped events: same
 *     (entity_type, entity_id, changed_by, action) within a 2-second
 *     window collapses to one group whose {@code changes} list aggregates
 *     the per-field rows. The 2s window is a heuristic — see the prompt.
 *
 * Entity-name resolution is batched per type via {@link EntityNameResolver}
 * beans; actor-name resolution piggybacks on
 * {@link UserNameResolver#displayName} via a single repository round-trip
 * regardless of how many distinct actors appear on the page.
 */
@Service
@RequiredArgsConstructor
public class ChangeLogReadService {

    /** Audit-grouping window. See class javadoc + prompt rationale. */
    static final Duration GROUPING_WINDOW = Duration.ofSeconds(2);

    private final ChangeLogEntryRepository repository;
    private final UserRepository userRepository;
    private final EntityHrefResolver hrefResolver;
    private final List<EntityNameResolver> resolvers;

    private Map<String, EntityNameResolver> resolverByType;

    private Map<String, EntityNameResolver> resolverByType() {
        // Built lazily from the injected list so spring autowires every
        // resolver bean exactly once and we don't pay map-construction cost
        // per call.
        if (resolverByType == null) {
            Map<String, EntityNameResolver> map = new HashMap<>();
            for (EntityNameResolver r : resolvers) map.put(r.entityType(), r);
            resolverByType = Map.copyOf(map);
        }
        return resolverByType;
    }

    // ---- public API -------------------------------------------------------

    @Transactional(readOnly = true)
    public ChangeLogPageResponse list(ChangeLogFilters filters, int page, int size) {
        Specification<ChangeLogEntry> spec = buildSpec(filters);
        Sort sort = Sort.by(filters.ascending() ? Sort.Direction.ASC : Sort.Direction.DESC,
            "changedAt").and(Sort.by(filters.ascending() ? Sort.Direction.ASC : Sort.Direction.DESC,
            "id"));
        Pageable pageable = PageRequest.of(page, size, sort);
        Page<ChangeLogEntry> rows = repository.findAll(spec, pageable);

        List<ChangeLogGroupDto> groups = assembleGroups(rows.getContent());
        boolean hasMore = rows.hasNext();

        return new ChangeLogPageResponse(
            groups,
            page,
            size,
            rows.getTotalElements(),
            hasMore
        );
    }

    @Transactional(readOnly = true)
    public List<ChangeLogEntry> listRawForExport(ChangeLogFilters filters) {
        Specification<ChangeLogEntry> spec = buildSpec(filters);
        Sort sort = Sort.by(filters.ascending() ? Sort.Direction.ASC : Sort.Direction.DESC,
            "changedAt").and(Sort.by(filters.ascending() ? Sort.Direction.ASC : Sort.Direction.DESC,
            "id"));
        return repository.findAll(spec, sort);
    }

    /**
     * Bundle of rows + per-row name maps for CSV export. The single call
     * pre-resolves names so the streaming writer doesn't have to make
     * lookups while writing.
     */
    public record ExportBundle(
        List<ChangeLogEntry> rows,
        Map<Long, String> actorNames,
        Map<String, Map<Long, String>> entityNamesByType
    ) {}

    @Transactional(readOnly = true)
    public ExportBundle exportBundle(ChangeLogFilters filters) {
        List<ChangeLogEntry> rows = listRawForExport(filters);

        Set<Long> actorIds = rows.stream()
            .map(ChangeLogEntry::getChangedBy)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Long, String> actorNames = resolveActorNames(new ArrayList<>(actorIds));

        Map<String, Set<Long>> idsByType = new HashMap<>();
        for (ChangeLogEntry r : rows) {
            idsByType.computeIfAbsent(r.getEntityType(), k -> new HashSet<>()).add(r.getEntityId());
        }
        Map<String, Map<Long, String>> entityNamesByType = new HashMap<>();
        idsByType.forEach((type, ids) -> {
            EntityNameResolver resolver = resolverByType().get(type);
            entityNamesByType.put(type, resolver == null ? Map.of() : resolver.resolveNames(ids));
        });

        return new ExportBundle(rows, actorNames, entityNamesByType);
    }

    @Transactional(readOnly = true)
    public ChangeLogFilterOptions filterOptions() {
        // Filter-context-independent — the universe of values that ever
        // wrote a row, regardless of any filters the user has selected.
        // Otherwise the dropdowns empty out as the user narrows.
        List<String> entityTypes = repository.findDistinctEntityTypes();
        List<ChangeAction> actions = repository.findDistinctActions();
        List<Long> actorIds = repository.findDistinctActorIds();

        Map<Long, String> actorNames = resolveActorNames(actorIds);

        List<EntityFilterOption> entityOpts = entityTypes.stream()
            .sorted(Comparator.comparing(ChangeLogLabels::forEntityType))
            .map(t -> new EntityFilterOption(t, ChangeLogLabels.forEntityType(t)))
            .toList();

        List<ActionFilterOption> actionOpts = actions.stream()
            .sorted(Comparator.comparing(ChangeLogLabels::forAction))
            .map(a -> new ActionFilterOption(a, ChangeLogLabels.forAction(a)))
            .toList();

        // Case-insensitive so a mixed-case roster (e.g. "alice" / "Bob")
        // doesn't sort by ASCII codepoint. Cheap insurance for when the
        // actor population grows past a handful.
        List<UserFilterOption> actorOpts = actorIds.stream()
            .sorted(Comparator.comparing(
                (Long id) -> actorNames.getOrDefault(id, ""),
                String.CASE_INSENSITIVE_ORDER
            ))
            .map(id -> new UserFilterOption(id, actorNames.getOrDefault(id, UserNameResolver.DELETED)))
            .toList();

        return new ChangeLogFilterOptions(entityOpts, actionOpts, actorOpts);
    }

    // ---- specification builder --------------------------------------------

    Specification<ChangeLogEntry> buildSpec(ChangeLogFilters filters) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (filters.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("changedAt"), filters.from()));
            }
            if (filters.to() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("changedAt"), filters.to()));
            }
            if (filters.entityTypes() != null && !filters.entityTypes().isEmpty()) {
                predicates.add(root.get("entityType").in(filters.entityTypes()));
            }
            if (filters.actions() != null && !filters.actions().isEmpty()) {
                predicates.add(root.get("action").in(filters.actions()));
            }
            if (filters.actorIds() != null && !filters.actorIds().isEmpty()) {
                predicates.add(root.get("changedBy").in(filters.actorIds()));
            }

            String search = filters.search() == null ? "" : filters.search().trim();
            if (!search.isEmpty()) {
                Predicate searchPredicate = buildSearchPredicate(search, root, cb);
                if (searchPredicate != null) predicates.add(searchPredicate);
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Two-pass search: resolve "users whose current name matches" and
     * "entities whose current name matches" up front, then build an OR
     * predicate over the resulting id sets. See {@link ChangeLogFilters}
     * for the historical-name caveat.
     */
    private Predicate buildSearchPredicate(
        String search,
        jakarta.persistence.criteria.Root<ChangeLogEntry> root,
        jakarta.persistence.criteria.CriteriaBuilder cb
    ) {
        String pattern = "%" + search.toLowerCase() + "%";
        List<Predicate> ors = new ArrayList<>();

        // 1) Actors whose display name matches → row's changed_by.
        Set<Long> matchingActorIds = resolverByType().values().stream()
            .filter(r -> com.acme.estimator.users.UserService.ENTITY_TYPE.equals(r.entityType()))
            .findFirst()
            .map(r -> r.findIdsMatchingName(search))
            .orElseGet(Set::of);
        if (!matchingActorIds.isEmpty()) {
            ors.add(root.get("changedBy").in(matchingActorIds));
        }

        // 2) Entities whose current name matches, per resolver type.
        for (EntityNameResolver resolver : resolvers) {
            Set<Long> ids = resolver.findIdsMatchingName(search);
            if (!ids.isEmpty()) {
                ors.add(cb.and(
                    cb.equal(root.get("entityType"), resolver.entityType()),
                    root.get("entityId").in(ids)
                ));
            }
        }

        // 3) Field name and notes — cheap LIKE on plain columns.
        ors.add(cb.like(cb.lower(root.get("fieldName")), pattern));
        ors.add(cb.like(cb.lower(cb.coalesce(root.get("notes"), "")), pattern));

        return cb.or(ors.toArray(new Predicate[0]));
    }

    // ---- group assembly ---------------------------------------------------

    /**
     * Walks the row list (sorted by changedAt + id) and folds consecutive
     * rows that share (entityType, entityId, changedBy, action) within
     * {@link #GROUPING_WINDOW} into one group. Field-level rows under an
     * UPDATED group become the {@code changes} list.
     */
    List<ChangeLogGroupDto> assembleGroups(List<ChangeLogEntry> rows) {
        if (rows.isEmpty()) return List.of();

        List<List<ChangeLogEntry>> rawGroups = collapse(rows);

        // Resolve all entity names per type in one round-trip per type.
        Map<String, Map<Long, String>> namesByType = resolveEntityNames(rawGroups);

        // Resolve actor names in one round-trip.
        Set<Long> actorIds = rawGroups.stream()
            .map(g -> g.get(0).getChangedBy())
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Long, String> actorNames = resolveActorNames(new ArrayList<>(actorIds));

        Map<String, Set<Long>> liveIdsByType = liveIdsByType(rawGroups);

        List<ChangeLogGroupDto> out = new ArrayList<>(rawGroups.size());
        for (List<ChangeLogEntry> group : rawGroups) {
            ChangeLogEntry primary = group.get(0); // already sorted DESC, so [0] is most recent
            Long entityId = primary.getEntityId();
            String entityType = primary.getEntityType();

            String entityName = namesByType
                .getOrDefault(entityType, Map.of())
                .getOrDefault(entityId, "Unknown " + ChangeLogLabels.forEntityType(entityType));

            boolean entityDeleted = !liveIdsByType
                .getOrDefault(entityType, Set.of())
                .contains(entityId);

            String actorName = actorNames.getOrDefault(primary.getChangedBy(), UserNameResolver.DELETED);
            ChangeLogActorDto actor = new ChangeLogActorDto(primary.getChangedBy(), actorName);

            List<ChangeLogChangeDto> changes = group.stream()
                .filter(e -> e.getFieldName() != null)
                .map(e -> new ChangeLogChangeDto(e.getFieldName(), e.getOldValue(), e.getNewValue()))
                .toList();

            String description = DescriptionFormatter.render(
                actorName, primary.getChangedBy(), primary.getAction(),
                entityType, entityId, entityName
            );

            String href = entityDeleted ? null : hrefResolver.resolve(entityType, entityId);

            out.add(new ChangeLogGroupDto(
                "group-" + primary.getId(),
                entityType,
                entityId,
                entityName,
                entityDeleted,
                primary.getAction(),
                actor,
                primary.getChangedAt(),
                primary.getSource() == null ? "WEB" : primary.getSource().name(),
                description,
                changes,
                href
            ));
        }
        return out;
    }

    /**
     * Fold consecutive rows that share the audit-group key. Rows are
     * expected pre-sorted (changedAt desc, id desc) — the call site
     * guarantees this.
     *
     * Package-private so the grouping unit tests can target this method
     * without standing up the full read service.
     */
    static List<List<ChangeLogEntry>> collapse(List<ChangeLogEntry> rows) {
        List<List<ChangeLogEntry>> out = new ArrayList<>();
        List<ChangeLogEntry> current = new ArrayList<>();
        for (ChangeLogEntry row : rows) {
            if (current.isEmpty()) {
                current.add(row);
                continue;
            }
            ChangeLogEntry head = current.get(0);
            if (sameKey(head, row) && withinWindow(head, row)) {
                current.add(row);
            } else {
                out.add(current);
                current = new ArrayList<>();
                current.add(row);
            }
        }
        if (!current.isEmpty()) out.add(current);
        return out;
    }

    private static boolean sameKey(ChangeLogEntry a, ChangeLogEntry b) {
        return Objects.equals(a.getEntityType(), b.getEntityType())
            && Objects.equals(a.getEntityId(), b.getEntityId())
            && Objects.equals(a.getChangedBy(), b.getChangedBy())
            && a.getAction() == b.getAction();
    }

    private static boolean withinWindow(ChangeLogEntry head, ChangeLogEntry candidate) {
        if (head.getChangedAt() == null || candidate.getChangedAt() == null) return false;
        Duration delta = Duration.between(candidate.getChangedAt(), head.getChangedAt()).abs();
        return delta.compareTo(GROUPING_WINDOW) <= 0;
    }

    // ---- name resolution helpers ------------------------------------------

    private Map<String, Map<Long, String>> resolveEntityNames(List<List<ChangeLogEntry>> rawGroups) {
        Map<String, Set<Long>> idsByType = new HashMap<>();
        for (List<ChangeLogEntry> g : rawGroups) {
            ChangeLogEntry head = g.get(0);
            idsByType.computeIfAbsent(head.getEntityType(), k -> new HashSet<>()).add(head.getEntityId());
        }
        Map<String, Map<Long, String>> out = new HashMap<>();
        idsByType.forEach((type, ids) -> {
            EntityNameResolver resolver = resolverByType().get(type);
            out.put(type, resolver == null ? Map.of() : resolver.resolveNames(ids));
        });
        return out;
    }

    private Map<String, Set<Long>> liveIdsByType(List<List<ChangeLogEntry>> rawGroups) {
        // Same logic as resolveEntityNames but returns "ids actually present
        // in the underlying table." Used to mark entityDeleted on the DTO.
        Map<String, Set<Long>> idsByType = new HashMap<>();
        for (List<ChangeLogEntry> g : rawGroups) {
            ChangeLogEntry head = g.get(0);
            idsByType.computeIfAbsent(head.getEntityType(), k -> new HashSet<>()).add(head.getEntityId());
        }
        Map<String, Set<Long>> out = new HashMap<>();
        idsByType.forEach((type, ids) -> {
            EntityNameResolver resolver = resolverByType().get(type);
            if (resolver == null) {
                out.put(type, Set.of());
                return;
            }
            // The resolver returns a "Deleted ..." placeholder for missing
            // ids; to know which ids are live we re-call and inspect.
            // (Cheap — populations are small and we already pay the call.)
            Map<Long, String> names = resolver.resolveNames(ids);
            Set<Long> live = new HashSet<>();
            String deletedPrefix = deletedPrefix(type);
            for (Map.Entry<Long, String> e : names.entrySet()) {
                if (!e.getValue().startsWith(deletedPrefix)) live.add(e.getKey());
            }
            out.put(type, live);
        });
        return out;
    }

    private static String deletedPrefix(String entityType) {
        return switch (entityType) {
            case "Team"             -> TeamNameResolver.DELETED;
            case "SdlcPhase"        -> SdlcPhaseNameResolver.DELETED;
            case "BlendedRate"      -> "Blended rate (deleted)";
            case "User"             -> UserNameResolver.DELETED;
            case "Product"          -> ProductNameResolver.DELETED;
            case "SubFeature"       -> SubFeatureNameResolver.DELETED;
            case "CriticalQuestion" -> CriticalQuestionNameResolver.DELETED;
            case "EstimateTemplate" -> EstimateTemplateNameResolver.DELETED;
            default                 -> "Deleted ";
        };
    }

    private Map<Long, String> resolveActorNames(List<Long> actorIds) {
        if (actorIds == null || actorIds.isEmpty()) return Map.of();
        Set<Long> idSet = new HashSet<>(actorIds);
        Map<Long, String> out = new LinkedHashMap<>();
        for (Long id : actorIds) {
            out.put(id, id != null && id == 0L ? UserNameResolver.SYSTEM : UserNameResolver.DELETED);
        }
        userRepository.findAllById(idSet).forEach(u ->
            out.put(u.getId(), UserNameResolver.displayName(u))
        );
        return out;
    }
}
