package com.acme.estimator.teams;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.teams.dto.BulkResult;
import com.acme.estimator.teams.dto.BulkResult.BulkFailure;
import com.acme.estimator.teams.dto.TeamCreateRequest;
import com.acme.estimator.teams.dto.TeamListItem;
import com.acme.estimator.teams.dto.TeamUpdateRequest;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final AuditService auditService;
    private final TransactionTemplate transactionTemplate;

    public enum StatusFilter { ALL, ACTIVE, INACTIVE }

    @Transactional(readOnly = true)
    public Page<TeamListItem> list(String search, StatusFilter status, Pageable pageable) {
        Page<Team> page = teamRepository.findAll(buildSpec(search, status), pageable);
        if (page.isEmpty()) {
            return page.map(t -> TeamListItem.from(t, 0L, 0L));
        }
        List<Long> teamIds = page.getContent().stream().map(Team::getId).toList();
        Map<Long, Long> memberCounts = buildCountMap(teamRepository.countMembersByTeamIdIn(teamIds));
        Map<Long, Long> productCounts = buildCountMap(teamRepository.countActiveProductsByTeamIdIn(teamIds));
        return page.map(t -> TeamListItem.from(
            t,
            productCounts.getOrDefault(t.getId(), 0L),
            memberCounts.getOrDefault(t.getId(), 0L)
        ));
    }

    private static Map<Long, Long> buildCountMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return map;
    }

    public record TeamExport(List<Team> teams, Map<Long, String> userNames) {}

    /** Loads the team rows for export AND resolves any updated_by ids to names in a single batch. */
    @Transactional(readOnly = true)
    public TeamExport listForExport(String search, StatusFilter status) {
        List<Team> teams = teamRepository.findAll(
            buildSpec(search, status), Sort.by("name").ascending()
        );

        Set<Long> userIds = new HashSet<>();
        for (Team t : teams) {
            if (t.getUpdatedBy() != null) userIds.add(t.getUpdatedBy());
            if (t.getCreatedBy() != null) userIds.add(t.getCreatedBy());
        }
        Map<Long, String> names = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u ->
            names.put(u.getId(), u.fullName())
        );
        return new TeamExport(teams, names);
    }

    @Transactional(readOnly = true)
    public Team get(Long id) {
        return teamRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Team " + id + " not found"));
    }

    @Transactional(readOnly = true)
    public List<ChangeLogEntry> history(Long id) {
        get(id);
        return changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(Team.ENTITY_TYPE, id);
    }

    @Transactional
    public Team create(TeamCreateRequest req, User actor) {
        teamRepository.findByNameIgnoreCase(req.name()).ifPresent(t -> {
            throw ApiException.conflict("A team named '" + t.getName() + "' already exists.");
        });

        Team team = new Team();
        team.setName(req.name().trim());
        team.setDescription(blankToNull(req.description()));
        team.setActive(req.active() == null ? true : req.active());
        team.setCreatedBy(actor.getId());
        team.setUpdatedBy(actor.getId());
        Team saved = teamRepository.save(team);

        auditService.recordCreated(Team.ENTITY_TYPE, saved.getId(), actor, null);
        return saved;
    }

    @Transactional
    public Team update(Long id, TeamUpdateRequest req, User actor) {
        Team team = get(id);

        if (req.active() != null && req.active() != team.isActive()) {
            throw ApiException.badRequest(
                "Use POST /activate or /deactivate to change a team's active status."
            );
        }

        if (req.name() != null && !req.name().trim().equalsIgnoreCase(team.getName())) {
            teamRepository.findByNameIgnoreCase(req.name().trim()).ifPresent(existing -> {
                if (!existing.getId().equals(team.getId())) {
                    throw ApiException.conflict(
                        "A team named '" + existing.getName() + "' already exists."
                    );
                }
            });
        }

        boolean dirty = false;

        if (req.name() != null) {
            String newName = req.name().trim();
            if (auditService.recordUpdated(
                Team.ENTITY_TYPE, team.getId(), "name", team.getName(), newName, actor
            )) {
                team.setName(newName);
                dirty = true;
            }
        }

        if (req.description() != null) {
            String newDescription = blankToNull(req.description());
            if (auditService.recordUpdated(
                Team.ENTITY_TYPE, team.getId(), "description",
                team.getDescription(), newDescription, actor
            )) {
                team.setDescription(newDescription);
                dirty = true;
            }
        }

        if (dirty) {
            team.setUpdatedBy(actor.getId());
            teamRepository.save(team);
        }
        return team;
    }

    @Transactional
    public Team activate(Long id, User actor) {
        Team team = get(id);
        if (team.isActive()) return team;
        team.setActive(true);
        team.setUpdatedBy(actor.getId());
        teamRepository.save(team);
        auditService.recordActivated(Team.ENTITY_TYPE, team.getId(), actor);
        return team;
    }

    @Transactional
    public Team deactivate(Long id, User actor) {
        Team team = get(id);
        if (!team.isActive()) return team;
        team.setActive(false);
        team.setUpdatedBy(actor.getId());
        teamRepository.save(team);
        auditService.recordDeactivated(Team.ENTITY_TYPE, team.getId(), actor);
        return team;
    }

    @Transactional
    public void delete(Long id, User actor) {
        Team team = get(id);
        long activeProducts = teamRepository.countActiveProductsByTeamId(team.getId());
        if (activeProducts > 0) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                "TEAM_HAS_PRODUCTS",
                "This team has " + activeProducts + " active product" +
                    (activeProducts == 1 ? "" : "s") +
                    ". Reassign or deactivate them before deleting the team."
            );
        }
        Long teamId = team.getId();
        teamRepository.delete(team);
        auditService.recordDeleted(Team.ENTITY_TYPE, teamId, actor, null);
    }

    // ---- bulk: each row in its own transaction ------------------------

    /**
     * The bulk methods are intentionally NOT @Transactional. Each row gets
     * its own transaction via {@link TransactionTemplate} so a per-row
     * failure does not roll back rows that already committed. The per-row
     * service methods stay @Transactional for direct (single-row) callers.
     */
    @Transactional(propagation = Propagation.NEVER)
    public BulkResult bulkActivate(List<Long> ids, User actor) {
        return runBulk(ids, id -> activate(id, actor));
    }

    @Transactional(propagation = Propagation.NEVER)
    public BulkResult bulkDeactivate(List<Long> ids, User actor) {
        return runBulk(ids, id -> deactivate(id, actor));
    }

    @Transactional(propagation = Propagation.NEVER)
    public BulkResult bulkDelete(List<Long> ids, User actor) {
        return runBulk(ids, id -> delete(id, actor));
    }

    private BulkResult runBulk(List<Long> ids, java.util.function.Consumer<Long> op) {
        List<Long> succeeded = new ArrayList<>();
        List<BulkFailure> failed = new ArrayList<>();
        for (Long id : ids) {
            try {
                transactionTemplate.executeWithoutResult(status -> op.accept(id));
                succeeded.add(id);
            } catch (ApiException ex) {
                failed.add(new BulkFailure(id, ex.getErrorCode(), ex.getMessage()));
            } catch (RuntimeException ex) {
                failed.add(new BulkFailure(id, "INTERNAL_ERROR", ex.getMessage()));
            }
        }
        return new BulkResult(succeeded, failed);
    }

    // ---- helpers --------------------------------------------------------

    private Specification<Team> buildSpec(String search, StatusFilter status) {
        StatusFilter effective = status == null ? StatusFilter.ALL : status;
        String query = search == null ? null : search.trim();

        return (root, cq, cb) -> {
            Predicate p = cb.conjunction();
            if (query != null && !query.isEmpty()) {
                String like = "%" + query.toLowerCase() + "%";
                p = cb.and(p, cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("description")), like)
                ));
            }
            switch (effective) {
                case ACTIVE -> p = cb.and(p, cb.isTrue(root.get("active")));
                case INACTIVE -> p = cb.and(p, cb.isFalse(root.get("active")));
                case ALL -> { /* no filter */ }
            }
            return p;
        };
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
