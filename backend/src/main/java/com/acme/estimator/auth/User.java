package com.acme.estimator.auth;

import com.acme.estimator.teams.Team;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
// Public no-args required by InvitationService.invite (which lives in
// com.acme.estimator.users and constructs new User() directly when issuing
// an invite). A future cleanup could move that creation into the auth
// package (UserRepository helper or User.newInvitee factory) to restore
// PROTECTED visibility — flagged as a Phase 5b+ refactor, not a 5a fix.
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private Long id;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "invitation_status", nullable = false, length = 32)
    private InvitationStatus invitationStatus = InvitationStatus.ACTIVE;

    @Column(name = "invited_by")
    private Long invitedBy;

    @Column(name = "invited_at")
    private OffsetDateTime invitedAt;

    @Column(name = "invitation_expires_at")
    private OffsetDateTime invitationExpiresAt;

    @Column(name = "invitation_accepted_at")
    private OffsetDateTime invitationAcceptedAt;

    @Column(name = "last_active_at")
    private OffsetDateTime lastActiveAt;

    @Column(name = "notifications_enabled", nullable = false)
    private boolean notificationsEnabled = true;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();

    // LAZY: teams are organizational metadata, never needed for auth checks.
    // Access user.getTeams() only within an open Hibernate session (i.e., inside
    // a @Transactional method or via a JOIN FETCH query).
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_teams",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "team_id")
    )
    private Set<Team> teams = new HashSet<>();

    public String fullName() {
        return firstName + " " + lastName;
    }

    public boolean hasRole(String roleName) {
        return roles.stream().anyMatch(r -> r.getName().equalsIgnoreCase(roleName));
    }

    /**
     * Phase 7.5: convenience for the "Admin implies every other role"
     * authorization model. Service-layer ownership checks read better as
     * {@code !actor.isAdmin() && request.getRequesterId() != actor.getId()}
     * than as a long {@code hasRole} chain.
     *
     * <p>Note: the implication is at the authorization layer, NOT a
     * data-write augmentation. {@code user_roles} stays as the actual
     * list of roles assigned; this method just answers "does the actor
     * literally have Admin." See CLAUDE.md "Phase 7.5" notes.
     */
    public boolean isAdmin() {
        return hasRole("Admin");
    }
}
