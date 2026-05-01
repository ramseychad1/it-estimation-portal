package com.acme.estimator.audit.read;

import java.util.Map;
import java.util.Set;

/**
 * Resolves a set of entity ids to their human-readable display names.
 *
 * The Change Log viewer needs to render rows like
 * "updated Team 'Application Development'", but {@code change_log} only
 * stores {@code (entity_type, entity_id)}. Resolvers turn ids into names
 * at query time via a single batch lookup per type — never N+1.
 *
 * Implementations are picked up by Spring as beans and wired into
 * {@link ChangeLogReadService} via {@link #entityType()} keys.
 *
 * <p>Missing-id contract: if an id is not in the underlying table (the
 * entity was hard-deleted), implementations return a placeholder string
 * for that id rather than omitting the entry. The placeholder copy is
 * resolver-specific (e.g. "Deleted team", "Deleted user").
 */
public interface EntityNameResolver {

    /** The {@code entity_type} string this resolver handles. */
    String entityType();

    /** Batch lookup. Every id in {@code ids} must appear in the result map. */
    Map<Long, String> resolveNames(Set<Long> ids);

    /**
     * Used by Change Log search: which ids of this entity type have a
     * <em>current</em> name containing the search substring.
     *
     * Resolves against current state only — historical names aren't
     * stored, so the search will miss rows whose entity was renamed
     * after the audited event. This is an intentional Phase 4 tradeoff
     * (no snapshot rows). Document, don't paper over.
     */
    Set<Long> findIdsMatchingName(String search);
}
