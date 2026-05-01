package com.acme.estimator.audit.read.dto;

import com.acme.estimator.audit.ChangeAction;
import java.time.OffsetDateTime;
import java.util.Set;

/**
 * Server-side projection of the controller's query string into a stable
 * shape. Built once per request, then handed to {@link
 * com.acme.estimator.audit.read.ChangeLogReadService} and the
 * specification builder.
 *
 * {@code search} is matched in two passes:
 *  1) Resolve the set of users / entities whose <em>current</em> name
 *     matches the substring (one query per resolver type).
 *  2) Add an OR predicate across {@code changed_by IN matchingUsers}
 *     and {@code (entity_type=X AND entity_id IN matchingX)} per type.
 *
 * Caveat: this resolves against current entity / user state, not the
 * historical state at the moment the audit row was written. We accept
 * that — Phase 4's "no snapshots" decision means historical names aren't
 * stored anywhere. Document the tradeoff rather than paper over it.
 */
public record ChangeLogFilters(
    String search,
    Set<String> entityTypes,
    Set<ChangeAction> actions,
    Set<Long> actorIds,
    OffsetDateTime from,
    OffsetDateTime to,
    boolean ascending
) {}
