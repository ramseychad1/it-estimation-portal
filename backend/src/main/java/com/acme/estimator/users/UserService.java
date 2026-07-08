package com.acme.estimator.users;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.audit.ChangeLogEntryRepository;
import com.acme.estimator.audit.ChangeSource;
import com.acme.estimator.auth.InvitationStatus;
import com.acme.estimator.auth.Role;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import com.acme.estimator.teams.dto.TeamRef;
import com.acme.estimator.users.dto.CompletePasswordResetRequest;
import com.acme.estimator.users.dto.DeleteUserRequest;
import com.acme.estimator.users.dto.ListUsersFilter;
import com.acme.estimator.users.dto.PasswordResetLinkResponse;
import com.acme.estimator.users.dto.UpdateUserRequest;
import com.acme.estimator.users.dto.UserDetail;
import com.acme.estimator.users.dto.UserListItem;
import com.acme.estimator.users.dto.ValidateTokenResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-side user management. Lives in {@code com.acme.estimator.users} so
 * the {@code auth} package stays focused on login/logout/me.
 *
 * Last-admin protection is enforced by reading {@code countActiveAdmins()}
 * inside the same transaction that performs the destructive change. Phase 3
 * accepts that under SERIALIZABLE-less isolation a vanishingly-rare race
 * could leave zero admins; documented as a known limitation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    public static final String ENTITY_TYPE = "User";
    private static final String ROLE_ADMIN = "Admin";

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final TokenGenerator tokenGenerator;
    private final EntityManager em;

    /** Reset links are handed over immediately, so a short TTL is fine. */
    private static final long RESET_TTL_MINUTES = 60;

    @Value("${app.base-url}")
    private String baseUrl;

    // ---- reads ---------------------------------------------------------

    /**
     * Returns a page of UserListItems with teams pre-loaded via a single batch query.
     * Mapping is done inside the transaction to avoid LazyInitializationException
     * (open-in-view=false).
     */
    @Transactional(readOnly = true)
    public Page<UserListItem> list(ListUsersFilter filter, Pageable pageable) {
        Page<User> page = userRepository.findAll(buildSpec(filter), pageable);
        if (page.isEmpty()) {
            return page.map(u -> UserListItem.from(u, List.of()));
        }
        List<Long> ids = page.getContent().stream().map(User::getId).toList();
        Map<Long, List<TeamRef>> teamMap = buildTeamMap(ids);
        return page.map(u -> UserListItem.from(u, teamMap.getOrDefault(u.getId(), List.of())));
    }

    @Transactional(readOnly = true)
    public List<User> listAllForExport(ListUsersFilter filter) {
        return userRepository.findAll(
            buildSpec(filter),
            Sort.by("email").ascending()
        );
    }

    @Transactional(readOnly = true)
    public User get(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("User " + id + " not found"));
    }

    /** Loads a user and their teams in one batch, returns a fully-populated UserDetail. */
    @Transactional(readOnly = true)
    public UserDetail getDetail(Long id) {
        User user = get(id);
        List<TeamRef> teams = loadUserTeams(user.getId());
        return UserDetail.from(user, teams);
    }

    /** Returns the team refs for a single user (one query). */
    @Transactional(readOnly = true)
    public List<TeamRef> loadUserTeams(Long userId) {
        return teamRepository.findTeamsByUserId(userId)
            .stream().map(TeamRef::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ChangeLogEntry> history(Long id) {
        get(id);
        return changeLogRepository
            .findByEntityTypeAndEntityIdOrderByChangedAtDesc(ENTITY_TYPE, id);
    }

    // ---- writes --------------------------------------------------------

    @Transactional
    public User update(Long id, UpdateUserRequest req, User actor) {
        User user = get(id);

        // Email change → uniqueness check (case-insensitive across all statuses).
        if (req.email() != null && !req.email().equalsIgnoreCase(user.getEmail())) {
            userRepository.findByEmailIgnoreCase(req.email().trim()).ifPresent(other -> {
                if (!other.getId().equals(user.getId())) {
                    throw ApiException.conflict(emailConflictMessage(other));
                }
            });
        }

        boolean dirty = false;

        if (req.firstName() != null) {
            String next = req.firstName().trim();
            if (auditService.recordUpdated(
                ENTITY_TYPE, user.getId(), "firstName", user.getFirstName(), next, actor
            )) {
                user.setFirstName(next);
                dirty = true;
            }
        }
        if (req.lastName() != null) {
            String next = req.lastName().trim();
            if (auditService.recordUpdated(
                ENTITY_TYPE, user.getId(), "lastName", user.getLastName(), next, actor
            )) {
                user.setLastName(next);
                dirty = true;
            }
        }
        if (req.email() != null) {
            String next = req.email().trim();
            if (auditService.recordUpdated(
                ENTITY_TYPE, user.getId(), "email", user.getEmail(), next, actor
            )) {
                user.setEmail(next);
                dirty = true;
            }
        }

        if (req.roleIds() != null) {
            Set<Role> currentRoles = user.getRoles();
            Set<Short> currentIds = currentRoles.stream().map(Role::getId).collect(Collectors.toSet());
            Set<Short> nextIds = new HashSet<>(req.roleIds());

            if (!Objects.equals(currentIds, nextIds)) {
                boolean wasAdmin = user.hasRole(ROLE_ADMIN);
                boolean willBeAdmin = nextIds.contains(adminRoleId(currentRoles));
                if (wasAdmin && !willBeAdmin
                        && user.getInvitationStatus() == InvitationStatus.ACTIVE
                        && userRepository.countActiveAdmins() <= 1) {
                    throw lastAdmin();
                }

                String oldRoleSummary = roleSummary(currentRoles);
                Set<Role> nextRoles = nextIds.stream()
                    .map(rid -> em.find(Role.class, rid))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
                if (nextRoles.size() != nextIds.size()) {
                    throw ApiException.badRequest("One or more role ids were not recognised.");
                }
                String newRoleSummary = roleSummary(nextRoles);

                user.getRoles().clear();
                user.getRoles().addAll(nextRoles);

                auditService.recordUpdated(
                    ENTITY_TYPE, user.getId(), "roles", oldRoleSummary, newRoleSummary, actor
                );
                dirty = true;
            }
        }

        if (req.teamIds() != null) {
            // user.getTeams() is safe here — we're inside @Transactional, session is open.
            String oldSummary = teamSummary(new ArrayList<>(user.getTeams()));
            Set<Long> dedupedIds = new HashSet<>(req.teamIds());
            List<Team> newTeams = resolveActiveTeams(dedupedIds);
            String newSummary = teamSummary(newTeams);

            if (!Objects.equals(oldSummary, newSummary)) {
                user.getTeams().clear();
                user.getTeams().addAll(newTeams);
                auditService.recordUpdated(
                    ENTITY_TYPE, user.getId(), "teams", oldSummary, newSummary, actor
                );
                dirty = true;
            }
        }

        if (dirty) {
            userRepository.save(user);
        }
        return user;
    }

    @Transactional
    public User activate(Long id, User actor) {
        User user = get(id);
        if (user.getInvitationStatus() == InvitationStatus.ACTIVE) return user;
        user.setActive(true);
        user.setInvitationStatus(InvitationStatus.ACTIVE);
        userRepository.save(user);
        auditService.recordActivated(ENTITY_TYPE, user.getId(), actor);
        return user;
    }

    @Transactional
    public User deactivate(Long id, User actor) {
        User user = get(id);
        if (user.getInvitationStatus() == InvitationStatus.INACTIVE) return user;

        if (user.hasRole(ROLE_ADMIN)
                && user.getInvitationStatus() == InvitationStatus.ACTIVE
                && userRepository.countActiveAdmins() <= 1) {
            throw lastAdmin();
        }

        user.setActive(false);
        user.setInvitationStatus(InvitationStatus.INACTIVE);
        userRepository.save(user);
        auditService.recordDeactivated(ENTITY_TYPE, user.getId(), actor);
        return user;
    }

    @Transactional
    public void delete(Long id, DeleteUserRequest body, User actor) {
        User user = get(id);

        String expected = (user.getFirstName() + " " + user.getLastName()).trim();
        String got = body.confirmationName() == null ? "" : body.confirmationName().trim();
        if (!expected.equalsIgnoreCase(got)) {
            throw ApiException.badRequest(
                "Confirmation name does not match. Type the user's full name to confirm deletion."
            );
        }

        if (user.hasRole(ROLE_ADMIN)
                && user.getInvitationStatus() == InvitationStatus.ACTIVE
                && userRepository.countActiveAdmins() <= 1) {
            throw lastAdmin();
        }

        Long userId = user.getId();
        userRepository.delete(user);
        auditService.recordDeleted(ENTITY_TYPE, userId, actor, null);
    }

    /**
     * Admin-initiated reset (SEC-1). Mints a single-use, time-limited token
     * and returns a copy/paste link the admin hands to the user out-of-band
     * (email isn't wired up). The old behaviour — generate a plaintext
     * password and write it to the log — is gone: no password is produced
     * here, and the raw token is never logged. Any outstanding reset token
     * for the user is revoked so only the newest link works.
     */
    @Transactional
    public PasswordResetLinkResponse resetPassword(Long id, User actor) {
        User user = get(id);
        // Pending invites still complete via the invite link; inactive users
        // can't sign in. Only re-key an account that's actually usable.
        if (user.getInvitationStatus() != InvitationStatus.ACTIVE) {
            throw ApiException.badRequest(
                "Password reset is only available for active users. "
                + "Pending invitations are completed via the invitation link.");
        }

        OffsetDateTime now = OffsetDateTime.now();
        for (PasswordResetToken prior
                : resetTokenRepository.findByUserIdAndUsedAtIsNullAndRevokedAtIsNull(user.getId())) {
            prior.setRevokedAt(now);
        }

        PasswordResetToken token = new PasswordResetToken();
        token.setToken(tokenGenerator.generate());
        token.setUserId(user.getId());
        token.setExpiresAt(now.plusMinutes(RESET_TTL_MINUTES));
        resetTokenRepository.save(token);

        ChangeLogEntry entry = new ChangeLogEntry();
        entry.setEntityType(ENTITY_TYPE);
        entry.setEntityId(user.getId());
        entry.setAction(ChangeAction.PASSWORD_RESET);
        entry.setChangedBy(actor.getId());
        entry.setSource(ChangeSource.WEB);
        changeLogRepository.save(entry);

        // Log the ACTION, never the secret — shortPrefix is safe to correlate.
        log.info("Password reset link issued for {} by {} (token {})",
            user.getEmail(), actor.getEmail(), tokenGenerator.shortPrefix(token.getToken()));
        return new PasswordResetLinkResponse(buildResetUrl(token.getToken()), token.getExpiresAt());
    }

    /**
     * Public: is this reset token still good? Mirrors the invite-validate
     * contract — on failure, email/expiry are omitted so we don't leak
     * account existence.
     */
    @Transactional(readOnly = true)
    public ValidateTokenResponse validateResetToken(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) return ValidateTokenResponse.invalid();
        PasswordResetToken token = resetTokenRepository.findByToken(tokenValue).orElse(null);
        if (token == null || !token.isUsable(OffsetDateTime.now())) {
            return ValidateTokenResponse.invalid();
        }
        User user = userRepository.findById(token.getUserId()).orElse(null);
        if (user == null) return ValidateTokenResponse.invalid();
        return ValidateTokenResponse.valid(user.getEmail(), token.getExpiresAt());
    }

    /**
     * Public: set a new password from a reset token. No current-password
     * check by design — the user may have forgotten it. Single-use: the
     * token is consumed on success.
     */
    @Transactional
    public void completePasswordReset(String tokenValue, CompletePasswordResetRequest req) {
        PasswordResetToken token = resetTokenRepository.findByToken(tokenValue)
            .orElseThrow(() -> ApiException.badRequest("This reset link is no longer valid."));
        OffsetDateTime now = OffsetDateTime.now();
        if (!token.isUsable(now)) {
            throw ApiException.badRequest("This reset link is no longer valid.");
        }
        User user = userRepository.findById(token.getUserId())
            .orElseThrow(() -> ApiException.badRequest("This reset link is no longer valid."));

        user.setPasswordHash(passwordEncoder.encode(req.password()));
        userRepository.save(user);

        token.setUsedAt(now);
        resetTokenRepository.save(token);

        ChangeLogEntry entry = new ChangeLogEntry();
        entry.setEntityType(ENTITY_TYPE);
        entry.setEntityId(user.getId());
        entry.setAction(ChangeAction.PASSWORD_RESET);
        // Self-service completion — attribute to the user themselves.
        entry.setChangedBy(user.getId());
        entry.setSource(ChangeSource.WEB);
        changeLogRepository.save(entry);
    }

    private String buildResetUrl(String token) {
        String base = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        return base + "/reset/" + token;
    }

    // ---- helpers -------------------------------------------------------

    /**
     * Batch-loads teams for a list of user IDs and groups them by user.
     * Two queries total per paged list request (the main page query + this one).
     */
    private Map<Long, List<TeamRef>> buildTeamMap(List<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        List<User> withTeams = userRepository.findByIdInWithTeams(userIds);
        Map<Long, List<TeamRef>> map = new HashMap<>();
        for (User u : withTeams) {
            map.put(u.getId(), u.getTeams().stream()
                .sorted(Comparator.comparing(Team::getName))
                .map(TeamRef::from)
                .toList());
        }
        return map;
    }

    /**
     * Resolves a set of team IDs to Team entities, validating each exists and is active.
     * Uses a single findAllById to avoid N queries.
     */
    private List<Team> resolveActiveTeams(Set<Long> teamIds) {
        if (teamIds.isEmpty()) return List.of();
        List<Team> found = teamRepository.findAllById(teamIds);
        if (found.size() != teamIds.size()) {
            throw ApiException.badRequest("One or more team ids were not recognised.");
        }
        List<Team> inactive = found.stream().filter(t -> !t.isActive()).toList();
        if (!inactive.isEmpty()) {
            throw ApiException.badRequest("Team '" + inactive.get(0).getName() + "' is inactive.");
        }
        return found;
    }

    private Specification<User> buildSpec(ListUsersFilter f) {
        return (root, cq, cb) -> {
            if (cq != null) cq.distinct(true);
            Predicate p = cb.conjunction();

            if (f != null && f.search() != null && !f.search().isBlank()) {
                String like = "%" + f.search().trim().toLowerCase() + "%";
                p = cb.and(p, cb.or(
                    cb.like(cb.lower(root.get("email")), like),
                    cb.like(cb.lower(root.get("firstName")), like),
                    cb.like(cb.lower(root.get("lastName")), like)
                ));
            }

            if (f != null && f.status() != null) {
                p = cb.and(p, cb.equal(root.get("invitationStatus"), f.status()));
            }

            if (f != null && f.roleNames() != null && !f.roleNames().isEmpty()) {
                Join<User, Role> roleJoin = root.join("roles");
                p = cb.and(p, roleJoin.get("name").in(f.roleNames()));
            }

            return p;
        };
    }

    private static String roleSummary(Set<Role> roles) {
        return roles.stream()
            .map(Role::getName)
            .sorted()
            .reduce((a, b) -> a + ", " + b)
            .orElse("");
    }

    private static String teamSummary(List<Team> teams) {
        return teams.stream()
            .map(Team::getName)
            .sorted()
            .reduce((a, b) -> a + ", " + b)
            .orElse("");
    }

    private Short adminRoleId(Set<Role> currentRoles) {
        return currentRoles.stream()
            .filter(r -> ROLE_ADMIN.equalsIgnoreCase(r.getName()))
            .map(Role::getId)
            .findFirst()
            .orElseGet(() -> {
                Role admin = em.find(Role.class, (short) 1);
                return admin != null ? admin.getId() : (short) -1;
            });
    }

    private String emailConflictMessage(User existing) {
        if (existing.getInvitationStatus() == InvitationStatus.PENDING_INVITE) {
            return "That email already has a pending invitation. Resend or revoke it first.";
        }
        return "An account with that email already exists.";
    }

    private static ApiException lastAdmin() {
        return new ApiException(
            HttpStatus.CONFLICT,
            "LAST_ADMIN_PROTECTION",
            "This is the only active Admin. Promote another user to Admin before continuing."
        );
    }

}
