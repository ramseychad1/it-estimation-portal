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
    SENT_BACK,

    // ---- Per-item review workflow (Phase 9b) --------------------------------
    // Replaces the request-level REVIEW_STARTED/APPROVED/REJECTED/SENT_BACK
    // actions for multi-product requests. Each action names the product so
    // the audit description carries full context without a separate lookup.

    /** SO claimed a specific item (product line) for review. */
    ITEM_REVIEW_STARTED,
    /** SO released a specific item back to the queue without a decision. */
    ITEM_REVIEW_RELEASED,
    /** SO approved a specific item. Notes carry complexity + blended-rate snapshot. */
    ITEM_APPROVED,
    /** SO rejected a specific item. Notes carry the first ~100 chars of the reason. */
    ITEM_REJECTED,
    /** Requester revised a rejected item (new answers and/or product swap). */
    ITEM_REVISED,
    /** Requester resubmitted a revised item; template re-snapshotted. */
    ITEM_RESUBMITTED,
    /** Requester removed a rejected item from the request entirely. */
    ITEM_DROPPED,
    /** Admin sent an approved item back to SUBMITTED (per-item safety valve). */
    ITEM_SENT_BACK,

    // ---- Clarification + Recall workflow (Phase 10) -----------------------

    /** SO requested clarification from the requester before continuing review. */
    ITEM_CLARIFICATION_REQUESTED,
    /** Requester responded to the SO's clarification request and resubmitted. */
    ITEM_CLARIFICATION_ANSWERED,
    /** Requester recalled an item from SUBMITTED or IN_REVIEW back to editable state. */
    ITEM_RECALLED,

    // ---- Revenue & Pricing Review workflow (V27) --------------------------

    /** Revenue Manager claimed a fully-approved request for pricing review. */
    PRICING_REVIEW_STARTED,
    /** Revenue Manager released a request from pricing review without a decision. */
    PRICING_REVIEW_RELEASED,
    /** Revenue Manager approved the pricing review; estimate is now fully approved. */
    PRICING_REVIEW_APPROVED,

    /** Admin-only: global app setting was changed. */
    SETTING_UPDATED
}
