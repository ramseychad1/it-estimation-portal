package com.acme.estimator.audit.read;

import static org.assertj.core.api.Assertions.assertThat;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pure-logic tests for {@link ChangeLogReadService#collapse} — the
 * audit-grouping window heuristic. No Spring context, no DB.
 */
class ChangeLogReadServiceTest {

    private static final OffsetDateTime BASE =
        OffsetDateTime.of(2026, 5, 1, 10, 0, 0, 0, ZoneOffset.UTC);

    @Test
    void rowsWithinTwoSeconds_sameKey_collapseToOneGroup() {
        ChangeLogEntry a = row(1L, "Team", 5L, ChangeAction.UPDATED, 2L, BASE.plusSeconds(1));
        ChangeLogEntry b = row(2L, "Team", 5L, ChangeAction.UPDATED, 2L, BASE);

        // Sorted by changedAt DESC, id DESC, as the call site guarantees.
        List<List<ChangeLogEntry>> groups = ChangeLogReadService.collapse(List.of(a, b));

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0)).containsExactly(a, b);
    }

    @Test
    void rowsThreeSecondsApart_sameKey_doNotCollapse() {
        ChangeLogEntry a = row(2L, "Team", 5L, ChangeAction.UPDATED, 2L, BASE.plusSeconds(3));
        ChangeLogEntry b = row(1L, "Team", 5L, ChangeAction.UPDATED, 2L, BASE);

        List<List<ChangeLogEntry>> groups = ChangeLogReadService.collapse(List.of(a, b));

        assertThat(groups).hasSize(2);
        assertThat(groups.get(0)).containsExactly(a);
        assertThat(groups.get(1)).containsExactly(b);
    }

    @Test
    void differentActor_breaksGrouping() {
        ChangeLogEntry a = row(2L, "Team", 5L, ChangeAction.UPDATED, /*actor*/ 2L, BASE.plusSeconds(1));
        ChangeLogEntry b = row(1L, "Team", 5L, ChangeAction.UPDATED, /*actor*/ 3L, BASE);

        List<List<ChangeLogEntry>> groups = ChangeLogReadService.collapse(List.of(a, b));

        assertThat(groups).hasSize(2);
    }

    @Test
    void differentAction_breaksGrouping() {
        ChangeLogEntry a = row(2L, "Team", 5L, ChangeAction.CREATED, 2L, BASE.plusSeconds(1));
        ChangeLogEntry b = row(1L, "Team", 5L, ChangeAction.UPDATED, 2L, BASE);

        List<List<ChangeLogEntry>> groups = ChangeLogReadService.collapse(List.of(a, b));

        assertThat(groups).hasSize(2);
    }

    private static ChangeLogEntry row(
        Long id, String entityType, Long entityId, ChangeAction action,
        Long actor, OffsetDateTime at
    ) {
        ChangeLogEntry e = new ChangeLogEntry();
        e.setId(id);
        e.setEntityType(entityType);
        e.setEntityId(entityId);
        e.setAction(action);
        e.setChangedBy(actor);
        e.setChangedAt(at);
        return e;
    }
}
