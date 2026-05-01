package com.acme.estimator.audit;

/**
 * Action vocabulary for change_log rows. Stored as the string literal
 * (not the ordinal) so the database remains self-describing.
 */
public enum ChangeAction {
    CREATED,
    UPDATED,
    ACTIVATED,
    DEACTIVATED,
    DELETED,
    REORDERED,
    /** Admin triggered a password reset. The new password is logged to the
     *  service stdout (DEV ONLY) and never persisted into change_log. */
    PASSWORD_RESET,
    /** A pending invitation was revoked by an admin before the invitee
     *  accepted it. The user row stays put with status = INACTIVE. */
    INVITATION_REVOKED,
    /** The invitee accepted their invitation, set a password, and the user
     *  transitioned from PENDING_INVITE to ACTIVE. */
    INVITATION_ACCEPTED
}
