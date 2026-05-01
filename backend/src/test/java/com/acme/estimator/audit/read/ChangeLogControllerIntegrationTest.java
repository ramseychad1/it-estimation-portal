package com.acme.estimator.audit.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.audit.ChangeSource;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end coverage of the Change Log read API: filter wiring, audit
 * grouping, entity-name resolution, deletion handling, security, and CSV
 * export.
 *
 * Uses {@link org.junit.jupiter.api.BeforeEach}-driven {@code deleteAll()}
 * for state cleanup, matching {@code TeamControllerIntegrationTest}.
 * {@code @Transactional} would be tidier but interacts badly with the
 * team test's StreamingResponseBody assertions when both classes are in
 * the same Surefire run.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ChangeLogControllerIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private ChangeLogEntryRepository changeLogRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    private AppUserDetails admin;
    private AppUserDetails estimator;
    private Long adminId;
    private Long estimatorId;

    @BeforeEach
    void setUp() {
        // Same pattern as TeamControllerIntegrationTest: clear teams +
        // change_log per test so state from the previous test (and from
        // other test classes that ran earlier in the JVM) doesn't leak.
        teamRepository.deleteAll();
        changeLogRepository.deleteAll();

        admin = new AppUserDetails(userRepository.findByEmailIgnoreCase("admin@local").orElseThrow());
        estimator = new AppUserDetails(userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow());
        adminId = userRepository.findByEmailIgnoreCase("admin@local").orElseThrow().getId();
        estimatorId = userRepository.findByEmailIgnoreCase("estimator@local").orElseThrow().getId();
    }

    // ---- security ----------------------------------------------------------

    @Test
    void anonymous_returns401() throws Exception {
        mvc.perform(get("/api/admin/change-log"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void nonAdmin_returns403() throws Exception {
        mvc.perform(get("/api/admin/change-log").with(user(estimator)))
            .andExpect(status().isForbidden());
    }

    // ---- groups feed -------------------------------------------------------

    @Test
    void list_returnsGroupsInChangedAtDescOrder() throws Exception {
        Team team = createTeam("Backend");
        OffsetDateTime base = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.CREATED, adminId, base, null, null, null);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, base.plusMinutes(2),
            "name", "Backend", "Backend Platform");

        mvc.perform(get("/api/admin/change-log").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups.length()").value(2))
            // Most recent first: UPDATED then CREATED.
            .andExpect(jsonPath("$.groups[0].action").value("UPDATED"))
            .andExpect(jsonPath("$.groups[1].action").value("CREATED"));
    }

    @Test
    void auditGrouping_threeFieldsOneSave_collapsesToOneGroupWithThreeChanges() throws Exception {
        Team team = createTeam("Mobile");
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        // Same actor, action, entity, within milliseconds — one logical save.
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, t,
            "name", "Old", "New");
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, t.plusNanos(500_000_000),
            "description", "Old desc", "New desc");
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, t.plusNanos(1_000_000_000),
            "active", "true", "false");

        mvc.perform(get("/api/admin/change-log").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].changes.length()").value(3))
            .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void auditGrouping_threeSecondsApart_rendersAsTwoGroups() throws Exception {
        Team team = createTeam("Data");
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, t,
            "name", "A", "B");
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, t.plusSeconds(3),
            "name", "B", "C");

        mvc.perform(get("/api/admin/change-log").with(user(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups.length()").value(2));
    }

    @Test
    void entityName_resolvesFromCurrentTeam() throws Exception {
        Team team = createTeam("Application Development");
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId,
            OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1),
            "name", "App Dev", "Application Development");

        mvc.perform(get("/api/admin/change-log").with(user(admin)))
            .andExpect(jsonPath("$.groups[0].entityName").value("Application Development"))
            .andExpect(jsonPath("$.groups[0].entityDeleted").value(false))
            .andExpect(jsonPath("$.groups[0].viewEntityHref").value("/admin/teams"));
    }

    @Test
    void entityDeleted_flaggedAndViewHrefIsNull() throws Exception {
        // Reference an id that doesn't exist (team was deleted post-audit).
        long ghostId = 99_999L;
        seedRow(Team.ENTITY_TYPE, ghostId, ChangeAction.DELETED, adminId,
            OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1), null, null, null);

        mvc.perform(get("/api/admin/change-log").with(user(admin)))
            .andExpect(jsonPath("$.groups[0].entityName").value("Deleted team"))
            .andExpect(jsonPath("$.groups[0].entityDeleted").value(true))
            .andExpect(jsonPath("$.groups[0].viewEntityHref").doesNotExist());
    }

    // ---- filter wiring -----------------------------------------------------

    @Test
    void filterByEntityType_excludesOtherTypes() throws Exception {
        Team team = createTeam("Core");
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.CREATED, adminId, t, null, null, null);
        seedRow("SdlcPhase", 1L, ChangeAction.CREATED, adminId, t.plusSeconds(5), null, null, null);

        mvc.perform(get("/api/admin/change-log")
                .with(user(admin))
                .param("entityTypes", "Team"))
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].entityType").value("Team"));
    }

    @Test
    void filterByAction_returnsOnlyMatchingActions() throws Exception {
        Team team = createTeam("Filterable");
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.CREATED, adminId, t, null, null, null);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.DEACTIVATED, adminId, t.plusSeconds(5),
            null, null, null);

        mvc.perform(get("/api/admin/change-log")
                .with(user(admin))
                .param("actions", "DEACTIVATED"))
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].action").value("DEACTIVATED"));
    }

    @Test
    void filterByActor_returnsOnlyThatActorsRows() throws Exception {
        Team team = createTeam("Authored");
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.CREATED, adminId, t, null, null, null);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, estimatorId,
            t.plusSeconds(10), "name", "Old", "New");

        mvc.perform(get("/api/admin/change-log")
                .with(user(admin))
                .param("actorIds", String.valueOf(estimatorId)))
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].actor.id").value(estimatorId));
    }

    @Test
    void bareDateRange_includesEntireCalendarDay() throws Exception {
        // Regression target for the start-of-day / end-of-day normalization
        // in parseInstant. ?from=YYYY-MM-DD&to=YYYY-MM-DD must include rows
        // anywhere within that calendar day, not zero rows.
        Team team = createTeam("Datey");
        OffsetDateTime midDay = OffsetDateTime.of(2026, 4, 30, 14, 30, 0, 0, ZoneOffset.UTC);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, midDay,
            "name", "old", "new");

        mvc.perform(get("/api/admin/change-log")
                .with(user(admin))
                .param("from", "2026-04-30")
                .param("to", "2026-04-30"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].entityName").value("Datey"));
    }

    @Test
    void filterByDateRange_excludesRowsOutsideWindow() throws Exception {
        Team team = createTeam("Dated");
        OffsetDateTime old = OffsetDateTime.now(ZoneOffset.UTC).minusDays(45);
        OffsetDateTime recent = OffsetDateTime.now(ZoneOffset.UTC).minusDays(5);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.CREATED, adminId, old, null, null, null);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, recent,
            "name", "A", "B");

        // Default range is "last 30 days" — old row is excluded.
        mvc.perform(get("/api/admin/change-log").with(user(admin)))
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].action").value("UPDATED"));
    }

    @Test
    void searchByEntityName_findsMatchingRows() throws Exception {
        Team team = createTeam("Application Development");
        Team other = createTeam("Mobile Engineering");
        OffsetDateTime t = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1);
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId, t,
            "name", "Old", "Application Development");
        seedRow(Team.ENTITY_TYPE, other.getId(), ChangeAction.CREATED, adminId,
            t.plusSeconds(5), null, null, null);

        mvc.perform(get("/api/admin/change-log")
                .with(user(admin))
                .param("search", "application"))
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].entityName").value("Application Development"));
    }

    // ---- /filters endpoint -------------------------------------------------

    @Test
    void filtersEndpoint_returnsOnlyTypesWithRows() throws Exception {
        Team team = createTeam("Has rows");
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.CREATED, adminId,
            OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1), null, null, null);

        mvc.perform(get("/api/admin/change-log/filters").with(user(admin)))
            .andExpect(status().isOk())
            // Team must appear; SdlcPhase / BlendedRate may or may not depending
            // on what other tests have written this transaction, but we never
            // expect a "Templates" row since templates don't exist.
            .andExpect(jsonPath("$.entityTypes[?(@.value == 'Team')]").exists())
            .andExpect(jsonPath("$.entityTypes[?(@.value == 'Templates')]").doesNotExist())
            .andExpect(jsonPath("$.actions[?(@.value == 'CREATED')]").exists())
            .andExpect(jsonPath("$.actors[?(@.id == " + adminId + ")]").exists());
    }

    // ---- pagination --------------------------------------------------------

    @Test
    void oversizedPageSize_returns400() throws Exception {
        mvc.perform(get("/api/admin/change-log")
                .with(user(admin))
                .param("size", "10000"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.message")
                .value(org.hamcrest.Matchers.containsString("100")));
    }

    @Test
    void pagination_size10WithMoreRows_setsHasMoreTrue() throws Exception {
        Team team = createTeam("Paged");
        OffsetDateTime base = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(30);
        // 12 separate UPDATED groups (5 seconds apart so the audit-grouping
        // window doesn't collapse them).
        for (int i = 0; i < 12; i++) {
            seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId,
                base.plusSeconds(i * 5L),
                "name", "v" + i, "v" + (i + 1));
        }

        mvc.perform(get("/api/admin/change-log")
                .with(user(admin))
                .param("size", "10"))
            .andExpect(jsonPath("$.groups.length()").value(10))
            .andExpect(jsonPath("$.hasMore").value(true))
            .andExpect(jsonPath("$.totalElements").value(12));
    }

    // ---- CSV export --------------------------------------------------------

    @Test
    void csvExport_includesUtf8BomAndHeaderRow() throws Exception {
        Team team = createTeam("Exported");
        seedRow(Team.ENTITY_TYPE, team.getId(), ChangeAction.UPDATED, adminId,
            OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1),
            "name", "Old", "New");

        // StreamingResponseBody runs on Spring's async TaskExecutor; without
        // explicit asyncDispatch the response body races and may come back
        // empty under JVM load. Drive the dispatch deterministically.
        var asyncResult = mvc.perform(get("/api/admin/change-log/export")
                .with(user(admin)))
            .andExpect(request().asyncStarted())
            .andReturn();
        byte[] payload = mvc.perform(asyncDispatch(asyncResult))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition",
                org.hamcrest.Matchers.containsString("change_log_export_")))
            .andExpect(content().contentTypeCompatibleWith("text/csv"))
            .andReturn().getResponse().getContentAsByteArray();

        // UTF-8 BOM at byte 0.
        assertThat(payload[0]).isEqualTo((byte) 0xEF);
        assertThat(payload[1]).isEqualTo((byte) 0xBB);
        assertThat(payload[2]).isEqualTo((byte) 0xBF);

        String csv = new String(payload, java.nio.charset.StandardCharsets.UTF_8);
        // The first line (after BOM) is the header.
        assertThat(csv).contains("timestamp,actor_id,actor_name,action,entity_type");
        // Body row contains entity name + the field rename.
        assertThat(csv).contains("Exported");
        assertThat(csv).contains("\"name\"");
    }

    // ---- helpers -----------------------------------------------------------

    private Team createTeam(String name) {
        Team t = new Team();
        t.setName(name);
        t.setActive(true);
        t.setCreatedBy(adminId);
        t.setUpdatedBy(adminId);
        return teamRepository.save(t);
    }

    private void seedRow(
        String entityType,
        Long entityId,
        ChangeAction action,
        Long actorId,
        OffsetDateTime when,
        String fieldName,
        String oldValue,
        String newValue
    ) {
        // change_log.changed_at is insertable=false; round-trip via JDBC
        // so we can pin the timestamp explicitly per test. JdbcTemplate
        // uses its own connection so this works without a surrounding
        // transaction (unlike EntityManager's native query).
        jdbc.update("""
            insert into change_log
              (entity_type, entity_id, action, field_name, old_value, new_value,
               changed_by, changed_at, source)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            entityType,
            entityId,
            action.name(),
            fieldName,
            oldValue,
            newValue,
            actorId,
            Timestamp.from(when.toInstant()),
            ChangeSource.WEB.name()
        );
    }
}
