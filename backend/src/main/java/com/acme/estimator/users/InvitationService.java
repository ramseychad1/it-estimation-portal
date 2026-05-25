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
import com.acme.estimator.users.dto.AcceptInviteRequest;
import com.acme.estimator.users.dto.AcceptInviteResult;
import com.acme.estimator.users.dto.InvitationResult;
import com.acme.estimator.users.dto.InviteUserRequest;
import com.acme.estimator.users.dto.UserDetail;
import com.acme.estimator.users.dto.ValidateTokenResponse;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import com.acme.estimator.notifications.InvitationEmailRequestedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Invitation lifecycle: create + revoke + resend (admin) and validate +
 * accept (public).
 *
 * Tokens are 32-byte SecureRandom URL-safe Base64 strings. The raw value
 * is included in {@link InvitationResult#inviteUrl} for the admin to copy
 * (no email infrastructure yet) and is NEVER logged in full —
 * {@link TokenGenerator#shortPrefix(String)} provides a debug-safe excerpt.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationService {

    /** Marker password_hash for PENDING users. BCrypt will never match it. */
    private static final String PENDING_HASH = "PENDING_NO_PASSWORD_SET_VIA_INVITE";
    private static final int DEFAULT_EXPIRY_DAYS = 14;

    private final UserRepository userRepository;
    private final InvitationTokenRepository tokenRepository;
    private final ChangeLogEntryRepository changeLogRepository;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final TokenGenerator tokenGenerator;
    private final TeamRepository teamRepository;
    private final EntityManager em;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${app.base-url}")
    private String baseUrl;

    // ---- admin-side ----------------------------------------------------

    @Transactional
    public InvitationResult invite(InviteUserRequest req, User actor) {
        userRepository.findByEmailIgnoreCase(req.email().trim()).ifPresent(existing -> {
            throw ApiException.conflict(
                existing.getInvitationStatus() == InvitationStatus.PENDING_INVITE
                    ? "That email already has a pending invitation. Resend or revoke it first."
                    : "An account with that email already exists."
            );
        });

        // Resolve roles up front so an unknown id fails the whole call.
        Set<Role> roles = new HashSet<>();
        for (Short rid : req.roleIds()) {
            Role r = em.find(Role.class, rid);
            if (r == null) {
                throw ApiException.badRequest("Unknown role id: " + rid);
            }
            roles.add(r);
        }

        int expiresInDays = req.expiresInDays() == null ? DEFAULT_EXPIRY_DAYS : req.expiresInDays();
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusDays(expiresInDays);

        // Resolve team ids up front so an unknown/inactive id fails the whole call.
        List<Team> assignedTeams = new ArrayList<>();
        if (req.teamIds() != null && !req.teamIds().isEmpty()) {
            for (Long tid : new HashSet<>(req.teamIds())) {
                Team t = teamRepository.findById(tid).orElse(null);
                if (t == null || !t.isActive()) {
                    throw ApiException.badRequest("Unknown or inactive team id: " + tid);
                }
                assignedTeams.add(t);
            }
        }

        User user = new User();
        user.setEmail(req.email().trim());
        user.setFirstName(req.firstName().trim());
        user.setLastName(req.lastName().trim());
        user.setPasswordHash(PENDING_HASH);
        user.setActive(false);
        user.setInvitationStatus(InvitationStatus.PENDING_INVITE);
        user.setInvitedBy(actor.getId());
        user.setInvitedAt(now);
        user.setInvitationExpiresAt(expiresAt);
        user.getRoles().addAll(roles);
        user.getTeams().addAll(assignedTeams);
        userRepository.save(user);

        InvitationToken token = new InvitationToken();
        token.setToken(tokenGenerator.generate());
        token.setUserId(user.getId());
        token.setExpiresAt(expiresAt);
        tokenRepository.save(token);

        auditService.recordCreated(
            UserService.ENTITY_TYPE, user.getId(), actor,
            req.personalNote() != null && !req.personalNote().isBlank() ? req.personalNote() : null
        );

        log.info("Invitation created for {} (token prefix {})",
            user.getEmail(), TokenGenerator.shortPrefix(token.getToken()));

        List<TeamRef> teamRefs = assignedTeams.stream()
            .sorted(Comparator.comparing(Team::getName))
            .map(TeamRef::from)
            .toList();

        return new InvitationResult(
            UserDetail.from(user, teamRefs),
            buildInviteUrl(token.getToken()),
            token.getExpiresAt()
        );
    }

    @Transactional
    public void revoke(Long userId, User actor) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User " + userId + " not found"));
        if (user.getInvitationStatus() != InvitationStatus.PENDING_INVITE) {
            throw ApiException.badRequest("Only pending invitations can be revoked.");
        }

        Optional<InvitationToken> active = tokenRepository
            .findFirstByUserIdAndUsedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(userId);
        active.ifPresent(t -> {
            t.setRevokedAt(OffsetDateTime.now());
            tokenRepository.save(t);
        });

        user.setInvitationStatus(InvitationStatus.INACTIVE);
        userRepository.save(user);

        ChangeLogEntry entry = new ChangeLogEntry();
        entry.setEntityType(UserService.ENTITY_TYPE);
        entry.setEntityId(user.getId());
        entry.setAction(ChangeAction.INVITATION_REVOKED);
        entry.setChangedBy(actor.getId());
        entry.setSource(ChangeSource.WEB);
        changeLogRepository.save(entry);
    }

    @Transactional
    public InvitationResult resend(Long userId, User actor) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User " + userId + " not found"));
        if (user.getInvitationStatus() != InvitationStatus.PENDING_INVITE) {
            throw ApiException.badRequest("Only pending invitations can be resent.");
        }

        // Revoke whatever active token exists, then issue a fresh one with
        // a default-window expiry.
        OffsetDateTime now = OffsetDateTime.now();
        tokenRepository
            .findFirstByUserIdAndUsedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(userId)
            .ifPresent(t -> {
                t.setRevokedAt(now);
                tokenRepository.save(t);
            });

        OffsetDateTime expiresAt = now.plusDays(DEFAULT_EXPIRY_DAYS);
        InvitationToken token = new InvitationToken();
        token.setToken(tokenGenerator.generate());
        token.setUserId(user.getId());
        token.setExpiresAt(expiresAt);
        tokenRepository.save(token);

        user.setInvitationExpiresAt(expiresAt);
        userRepository.save(user);

        log.info("Invitation resent for {} (new token prefix {})",
            user.getEmail(), TokenGenerator.shortPrefix(token.getToken()));

        List<TeamRef> teamRefs = teamRepository.findTeamsByUserId(user.getId())
            .stream().map(TeamRef::from).toList();

        return new InvitationResult(
            UserDetail.from(user, teamRefs),
            buildInviteUrl(token.getToken()),
            expiresAt
        );
    }

    // ---- public (no auth) ----------------------------------------------

    @Transactional(readOnly = true)
    public ValidateTokenResponse validate(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            return ValidateTokenResponse.invalid();
        }
        Optional<InvitationToken> opt = tokenRepository.findByToken(tokenValue);
        if (opt.isEmpty()) return ValidateTokenResponse.invalid();
        InvitationToken token = opt.get();
        if (!token.isUsable(OffsetDateTime.now())) return ValidateTokenResponse.invalid();

        User user = userRepository.findById(token.getUserId())
            .orElse(null);
        if (user == null) return ValidateTokenResponse.invalid();
        return ValidateTokenResponse.valid(user.getEmail(), token.getExpiresAt());
    }

    @Transactional
    public AcceptInviteResult accept(String tokenValue, AcceptInviteRequest req) {
        InvitationToken token = tokenRepository.findByToken(tokenValue)
            .orElseThrow(() -> ApiException.conflict("Invitation is no longer valid."));
        OffsetDateTime now = OffsetDateTime.now();
        if (!token.isUsable(now)) {
            throw ApiException.conflict("Invitation is no longer valid.");
        }

        User user = userRepository.findById(token.getUserId())
            .orElseThrow(() -> ApiException.conflict("Invitation is no longer valid."));

        if (user.getInvitationStatus() != InvitationStatus.PENDING_INVITE) {
            throw ApiException.conflict("Invitation already used.");
        }

        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setInvitationStatus(InvitationStatus.ACTIVE);
        user.setActive(true);
        user.setInvitationAcceptedAt(now);
        userRepository.save(user);

        token.setUsedAt(now);
        tokenRepository.save(token);

        ChangeLogEntry entry = new ChangeLogEntry();
        entry.setEntityType(UserService.ENTITY_TYPE);
        entry.setEntityId(user.getId());
        entry.setAction(ChangeAction.INVITATION_ACCEPTED);
        // Self-action — no admin changed_by; attribute to the user themselves.
        entry.setChangedBy(user.getId());
        entry.setSource(ChangeSource.WEB);
        changeLogRepository.save(entry);

        // Make the result depend on the audit row save so the test's assertion
        // on row count sees a consistent state — otherwise the IDE warns.
        Objects.requireNonNull(entry.getId(), "audit row should have been assigned an id");

        return new AcceptInviteResult(user.getEmail());
    }

    // ---- email ---------------------------------------------------------

    /**
     * Sends the active invitation URL to the invited user's email address.
     * Throws {@link ApiException} if the user has no active pending token.
     * The email is dispatched via {@link InvitationEmailRequestedEvent} so that
     * a failed send never rolls back the caller's transaction.
     */
    @Transactional(readOnly = true)
    public void sendInvitationEmail(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User " + userId + " not found"));
        if (user.getInvitationStatus() != InvitationStatus.PENDING_INVITE) {
            throw ApiException.badRequest("Only pending invitations can have their email sent.");
        }
        InvitationToken token = tokenRepository
            .findFirstByUserIdAndUsedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(userId)
            .orElseThrow(() -> ApiException.badRequest("No active invitation token found for this user."));

        eventPublisher.publishEvent(new InvitationEmailRequestedEvent(
            user, buildInviteUrl(token.getToken()), token.getExpiresAt()
        ));
        log.info("Invitation email event published for {} (token prefix {})",
            user.getEmail(), TokenGenerator.shortPrefix(token.getToken()));
    }

    // ---- helpers -------------------------------------------------------

    private String buildInviteUrl(String token) {
        String base = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        return base + "/invite/" + token;
    }
}
