package com.acme.estimator.audit.read;

import static org.assertj.core.api.Assertions.assertThat;

import com.acme.estimator.audit.ChangeAction;
import org.junit.jupiter.api.Test;

/**
 * The formatter is load-bearing in the feed: every row's description
 * runs through it. Cheap insurance against regressions.
 */
class DescriptionFormatterTest {

    @Test
    void selfAction_invitationAccepted_collapsesToTheirInvitation() {
        String description = DescriptionFormatter.render(
            "Sarah Williams", 7L,
            ChangeAction.INVITATION_ACCEPTED,
            "User", 7L,
            "Sarah Williams"
        );
        assertThat(description).isEqualTo("Sarah Williams accepted their invitation");
    }

    @Test
    void selfAction_passwordReset_collapsesToTheirPassword() {
        String description = DescriptionFormatter.render(
            "Sarah Williams", 7L,
            ChangeAction.PASSWORD_RESET,
            "User", 7L,
            "Sarah Williams"
        );
        assertThat(description).isEqualTo("Sarah Williams reset their password");
    }

    @Test
    void nonSelfAction_onUser_keepsBothActorAndTarget() {
        // Admin (id=1) revokes invitee Sarah's (id=7) invitation. Both names
        // should appear so the feed reads as a third-party action.
        String description = DescriptionFormatter.render(
            "Local Admin", 1L,
            ChangeAction.INVITATION_REVOKED,
            "User", 7L,
            "Sarah Williams"
        );
        assertThat(description)
            .isEqualTo("Local Admin revoked invitation for User 'Sarah Williams'");
    }

    @Test
    void selfActionDetection_requiresUserEntityType() {
        // Same actor id and entity id, but on a Team — must NOT be treated
        // as a self-action. (A Team that happens to share the actor's
        // numeric id should still render as a normal third-party action.)
        String description = DescriptionFormatter.render(
            "Local Admin", 5L,
            ChangeAction.UPDATED,
            "Team", 5L,
            "Application Development"
        );
        assertThat(description)
            .isEqualTo("Local Admin updated Team 'Application Development'");
    }

    @Test
    void genericFallback_renamesUnhandledSelfActionToTheirAccount() {
        // PASSWORD_RESET and INVITATION_ACCEPTED have explicit phrasing;
        // any future self-action without an explicit case falls through
        // the generic branch ("X-ed their account") rather than producing
        // "Sarah deactivated Sarah".
        String description = DescriptionFormatter.render(
            "Sarah Williams", 7L,
            ChangeAction.DEACTIVATED,
            "User", 7L,
            "Sarah Williams"
        );
        assertThat(description).isEqualTo("Sarah Williams deactivated their account");
    }
}
