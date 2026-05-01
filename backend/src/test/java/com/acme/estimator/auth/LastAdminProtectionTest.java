package com.acme.estimator.auth;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lives in {@code com.acme.estimator.auth} so the test can reach the
 * package-protected {@link User} no-args constructor — matching the
 * production access modifier rather than relaxing it for tests. Phase 3
 * carry-over from the M1 review.
 */
@SpringBootTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional
class LastAdminProtectionTest {

    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager em;

    private Role adminRole;
    private Role estimatorRole;
    private Role soRole;

    @BeforeEach
    void setUp() {
        // Seeded roles from data.sql: 1=Admin, 2=Solution Owner, 3=Estimator, 4=Requester
        adminRole = em.find(Role.class, (short) 1);
        soRole = em.find(Role.class, (short) 2);
        estimatorRole = em.find(Role.class, (short) 3);
    }

    @Test
    void countsExactlyOne_whenOnlyTheSeededAdminIsActive() {
        long count = userRepository.countActiveAdmins();
        assertThat(count).isEqualTo(1);
    }

    @Test
    void ignoresPendingInviteAdmins() {
        User pending = saveUser("pending@local", "Pending", "Admin", InvitationStatus.PENDING_INVITE, adminRole);
        long count = userRepository.countActiveAdmins();
        assertThat(count).isEqualTo(1);
        assertThat(pending.getRoles()).extracting(Role::getName).contains("Admin");
    }

    @Test
    void ignoresInactiveAdmins() {
        saveUser("former@local", "Former", "Admin", InvitationStatus.INACTIVE, adminRole);
        long count = userRepository.countActiveAdmins();
        assertThat(count).isEqualTo(1);
    }

    @Test
    void countsActiveAdminsWithMultipleRolesOnce() {
        saveUser("multi@local", "Multi", "Hat", InvitationStatus.ACTIVE, adminRole, soRole, estimatorRole);
        long count = userRepository.countActiveAdmins();
        // Seeded admin + the multi-hat user; each user counted once even though one has 3 roles.
        assertThat(count).isEqualTo(2);
    }

    @Test
    void countsTwoIndependentActiveAdmins() {
        saveUser("second@local", "Second", "Admin", InvitationStatus.ACTIVE, adminRole);
        long count = userRepository.countActiveAdmins();
        assertThat(count).isEqualTo(2);
    }

    private User saveUser(String email, String first, String last,
                          InvitationStatus status, Role... roles) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash("$2y$10$placeholder");
        u.setFirstName(first);
        u.setLastName(last);
        u.setActive(status == InvitationStatus.ACTIVE);
        u.setInvitationStatus(status);
        for (Role r : roles) u.getRoles().add(r);
        userRepository.save(u);
        em.flush();
        return u;
    }
}
