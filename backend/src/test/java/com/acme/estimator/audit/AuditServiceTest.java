package com.acme.estimator.audit;

import static org.assertj.core.api.Assertions.assertThat;

import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional
class AuditServiceTest {

    @Autowired private AuditService auditService;
    @Autowired private ChangeLogEntryRepository changeLogRepo;
    @Autowired private UserRepository userRepo;

    private User actor;

    @BeforeEach
    void setUp() {
        actor = userRepo.findByEmailIgnoreCase("admin@local").orElseThrow();
        changeLogRepo.deleteAll();
    }

    @Test
    void recordCreated_writesOneRowWithNullField() {
        auditService.recordCreated("Team", 42L, actor, null);

        var rows = changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("Team", 42L);
        assertThat(rows).hasSize(1);
        var row = rows.get(0);
        assertThat(row.getAction()).isEqualTo(ChangeAction.CREATED);
        assertThat(row.getFieldName()).isNull();
        assertThat(row.getOldValue()).isNull();
        assertThat(row.getNewValue()).isNull();
        assertThat(row.getChangedBy()).isEqualTo(actor.getId());
        assertThat(row.getSource()).isEqualTo(ChangeSource.WEB);
    }

    @Test
    void recordUpdated_writesNothingWhenValuesAreEqual() {
        boolean wrote = auditService.recordUpdated(
            "Team", 1L, "name", "Same", "Same", actor
        );
        assertThat(wrote).isFalse();
        assertThat(changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("Team", 1L))
            .isEmpty();
    }

    @Test
    void recordUpdated_treatsNullsAsEqual() {
        boolean wrote = auditService.recordUpdated(
            "Team", 1L, "description", null, null, actor
        );
        assertThat(wrote).isFalse();
        assertThat(changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("Team", 1L))
            .isEmpty();
    }

    @Test
    void recordUpdated_writesRowWhenValuesDiffer() {
        boolean wrote = auditService.recordUpdated(
            "Team", 7L, "name", "Old name", "New name", actor
        );
        assertThat(wrote).isTrue();
        var rows = changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("Team", 7L);
        assertThat(rows).hasSize(1);
        var row = rows.get(0);
        assertThat(row.getAction()).isEqualTo(ChangeAction.UPDATED);
        assertThat(row.getFieldName()).isEqualTo("name");
        assertThat(row.getOldValue()).isEqualTo("Old name");
        assertThat(row.getNewValue()).isEqualTo("New name");
    }

    @Test
    void recordUpdated_handlesNullToValueTransition() {
        boolean wrote = auditService.recordUpdated(
            "Team", 7L, "description", null, "now has one", actor
        );
        assertThat(wrote).isTrue();
        assertThat(changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("Team", 7L))
            .hasSize(1);
    }

    @Test
    void recordReordered_writesNothingWhenOrderUnchanged() {
        auditService.recordReordered("SdlcPhase", 3L, 5, 5, actor);
        assertThat(changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("SdlcPhase", 3L))
            .isEmpty();
    }

    @Test
    void recordReordered_writesRowWhenOrderChanged() {
        auditService.recordReordered("SdlcPhase", 3L, 5, 2, actor);
        var rows = changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("SdlcPhase", 3L);
        assertThat(rows).hasSize(1);
        var row = rows.get(0);
        assertThat(row.getAction()).isEqualTo(ChangeAction.REORDERED);
        assertThat(row.getFieldName()).isEqualTo("display_order");
        assertThat(row.getOldValue()).isEqualTo("5");
        assertThat(row.getNewValue()).isEqualTo("2");
    }

    @Test
    void recordActivatedAndDeactivated_writeOneRowEach() {
        auditService.recordActivated("Team", 9L, actor);
        auditService.recordDeactivated("Team", 9L, actor);
        var rows = changeLogRepo.findByEntityTypeAndEntityIdOrderByChangedAtDesc("Team", 9L);
        assertThat(rows).hasSize(2);
        // Both actions present; order isn't asserted because the rows are
        // written in the same transaction microsecond and changed_at sort
        // isn't deterministic at that granularity.
        assertThat(rows).extracting(ChangeLogEntry::getAction)
            .containsExactlyInAnyOrder(ChangeAction.ACTIVATED, ChangeAction.DEACTIVATED);
    }
}
