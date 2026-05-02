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
    INVITATION_ACCEPTED,

    // ---- Estimate-request workflow (Phase 6b) ---------------------------
    // Phase 6a transitionally wrote SUBMITTED as CREATED+notes; V11's
    // backfill promotes those rows to SUBMITTED. New transitions land as
    // their own enum values from the start.

    /** Requester transitioned a Draft → Submitted. */
    SUBMITTED,
    /** SO claimed a Submitted request → In Review. */
    REVIEW_STARTED,
    /** SO released In Review back to Submitted (no terminal action). */
    REVIEW_RELEASED,
    /** SO approved an In Review request. Notes carry the chosen
     *  complexity + blended-rate version snapshotted at approval. */
    APPROVED,
    /** SO rejected an In Review request. Notes carry the first ~100
     *  chars of the rejection reason. */
    REJECTED,
    /** Admin sent an Approved or Rejected request back to Submitted —
     *  the safety valve for "we approved this in error." Notes carry
     *  the admin's reason. */
    SENT_BACK
}
