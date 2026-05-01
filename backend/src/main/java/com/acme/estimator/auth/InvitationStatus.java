package com.acme.estimator.auth;

/**
 * Lifecycle state of a user account.
 *
 *   ACTIVE         — can sign in normally; rows count toward "active admin" totals.
 *   PENDING_INVITE — created via invite, no usable password yet, invitation_tokens
 *                    row exists; cannot sign in via the standard login form.
 *   INACTIVE       — deactivated by an admin; cannot sign in; preserved for audit.
 *
 * Stored as a VARCHAR with a CHECK constraint (matches the existing
 * {@link com.acme.estimator.audit.ChangeAction} pattern — avoids native
 * Postgres enums which are awkward to migrate).
 */
public enum InvitationStatus {
    ACTIVE,
    PENDING_INVITE,
    INACTIVE
}
