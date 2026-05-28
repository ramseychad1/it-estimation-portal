package com.acme.estimator.notifications;

/**
 * Marker interface for all notification events published after a transaction commits.
 * Each event record carries the data needed to resolve recipients and fill the email template.
 * Per-event or per-user opt-out can be layered on top later by checking settings inside
 * NotificationService.handle() — no structural change required.
 */
public sealed interface NotificationEvent
    permits
        ItemSubmittedEvent,
        ItemApprovedEvent,
        ItemRejectedEvent,
        ItemNeedsClarificationEvent,
        ClarificationRespondedEvent,
        ItemRecalledEvent,
        ItemSentBackEvent,
        InvitationEmailRequestedEvent,
        RequestSentToPricingReviewEvent,
        PricingReviewApprovedEvent {
}
