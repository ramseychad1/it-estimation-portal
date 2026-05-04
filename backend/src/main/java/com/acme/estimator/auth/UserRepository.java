package com.acme.estimator.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository
    extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    @Query("select u from User u where lower(u.email) = lower(?1)")
    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Counts users that hold the Admin role AND are currently ACTIVE.
     * Pending invites and inactive users are excluded — they cannot
     * meaningfully act as admins.
     *
     * Used by the last-admin protection guard.
     */
    @Query("""
        select count(distinct u.id) from User u
        join u.roles r
        where r.name = 'Admin'
        and u.invitationStatus = com.acme.estimator.auth.InvitationStatus.ACTIVE
    """)
    long countActiveAdmins();

    /**
     * Used by the Change Log search predicate. Matches against
     * {@code firstName + ' ' + lastName} or {@code email} (case-insensitive).
     */
    @Query("""
        select u.id from User u
        where lower(concat(coalesce(u.firstName, ''), ' ', coalesce(u.lastName, ''))) like lower(concat('%', ?1, '%'))
           or lower(u.email) like lower(concat('%', ?1, '%'))
    """)
    java.util.List<Long> findIdsByDisplayNameContainingIgnoreCase(String search);

    /** Phase 7 dashboard: pendingInvitations + totalActiveUsers cards (Admin only). */
    long countByInvitationStatus(InvitationStatus invitationStatus);

    /**
     * Batch-loads users WITH their teams collection eagerly initialized.
     * Use this after a paged list query to avoid N+1 on teams (open-in-view=false).
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT DISTINCT u FROM User u LEFT JOIN FETCH u.teams WHERE u.id IN :ids"
    )
    java.util.List<User> findByIdInWithTeams(@org.springframework.data.repository.query.Param("ids") java.util.List<Long> ids);

    /** Reporting: all users who are members of a specific team. */
    @org.springframework.data.jpa.repository.Query(
        "SELECT DISTINCT u FROM User u JOIN FETCH u.teams t WHERE t.id = :teamId ORDER BY u.lastName, u.firstName"
    )
    java.util.List<User> findByTeamId(@org.springframework.data.repository.query.Param("teamId") Long teamId);

    /** Phase 9b: returns the team IDs the given user belongs to. Used for team-scoping review. */
    @org.springframework.data.jpa.repository.Query(
        "SELECT t.id FROM User u JOIN u.teams t WHERE u.id = :userId"
    )
    java.util.Set<Long> findTeamIdsByUserId(
        @org.springframework.data.repository.query.Param("userId") Long userId);
}
