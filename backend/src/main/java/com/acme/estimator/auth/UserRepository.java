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
}
