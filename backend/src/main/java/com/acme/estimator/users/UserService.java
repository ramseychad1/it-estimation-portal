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
import com.acme.estimator.users.dto.DeleteUserRequest;
import com.acme.estimator.users.dto.ListUsersFilter;
import com.acme.estimator.users.dto.UpdateUserRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
    private final ChangeLogEntryRepository changeLogRepository;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager em;

    private final SecureRandom passwordRandom = new SecureRandom();

    // ---- reads ---------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<User> list(ListUsersFilter filter, Pageable pageable) {
        return userRepository.findAll(buildSpec(filter), pageable);
    }

    @Transactional(readOnly = true)
    public List<User> listAllForExport(ListUsersFilter filter) {
        return userRepository.findAll(
            buildSpec(filter),
            org.springframework.data.domain.Sort.by("email").ascending()
        );
    }

    @Transactional(readOnly = true)
    public User get(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> ApiException.notFound("User " + id + " not found"));
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
            Set<Short> currentIds = currentRoles.stream().map(Role::getId).collect(java.util.stream.Collectors.toSet());
            Set<Short> nextIds = new HashSet<>(req.roleIds());

            if (!Objects.equals(currentIds, nextIds)) {
                // Last-admin protection: if removing Admin from the only Admin, block.
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
                    .collect(java.util.stream.Collectors.toSet());
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

        // Typed-name confirmation: case-insensitive match against "First Last".
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

    @Transactional
    public String resetPassword(Long id, User actor) {
        User user = get(id);
        String newPassword = generatePassword();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        ChangeLogEntry entry = new ChangeLogEntry();
        entry.setEntityType(ENTITY_TYPE);
        entry.setEntityId(user.getId());
        entry.setAction(ChangeAction.PASSWORD_RESET);
        entry.setChangedBy(actor.getId());
        entry.setSource(ChangeSource.WEB);
        changeLogRepository.save(entry);

        // DEV ONLY: surface the new password to the operator. Production
        // will email this; for MVP the admin reads it from server logs.
        log.warn("[DEV ONLY] Password reset for {}: {}", user.getEmail(), newPassword);
        return newPassword;
    }

    // ---- helpers -------------------------------------------------------

    private Specification<User> buildSpec(ListUsersFilter f) {
        return (root, cq, cb) -> {
            // Spring Data 3.x annotates {@code cq} as @Nullable on
            // Specification#toPredicate — count-query paths in some
            // implementations pass null. JpaRepositoryImpl in practice
            // always supplies a non-null cq for both the data fetch and
            // the count fetch, but the guard is the safe contract per
            // the API type.
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

    /**
     * The Admin role's id is fixed at 1 in V2 seed; we still look it up
     * from the loaded set so this stays robust if seeds ever change.
     */
    private Short adminRoleId(Set<Role> currentRoles) {
        return currentRoles.stream()
            .filter(r -> ROLE_ADMIN.equalsIgnoreCase(r.getName()))
            .map(Role::getId)
            .findFirst()
            .orElseGet(() -> {
                // Fall back to a separate lookup if the user has no roles yet.
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

    /**
     * Generates a 14-char password with at least one letter and one digit.
     * Just for admin-triggered resets; users set their own via the invite
     * accept flow.
     */
    private String generatePassword() {
        // 14 chars, alphanumeric, with positions 0 and 7 reserved for letter and digit.
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // omit confusables
        char[] out = new char[14];
        for (int i = 0; i < out.length; i++) {
            out[i] = alphabet.charAt(passwordRandom.nextInt(alphabet.length()));
        }
        // Force at least one letter and one digit at known positions.
        out[0] = "ABCDEFGHJKLMNPQRSTUVWXYZ".charAt(passwordRandom.nextInt(24));
        out[7] = "23456789".charAt(passwordRandom.nextInt(8));
        return new String(out);
    }

}
