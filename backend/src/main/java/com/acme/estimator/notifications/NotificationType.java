package com.acme.estimator.notifications;

public enum NotificationType {

    ITEM_SUBMITTED(
        "New item ready for review",
        "Notify when a requester submits an estimate item for review.",
        "Solution Owners"
    ),
    CLARIFICATION_RESPONDED(
        "Clarification received",
        "Notify when a requester responds to your clarification request.",
        "Solution Owners"
    ),
    ITEM_RECALLED(
        "Item recalled by requester",
        "Notify when a requester withdraws a submitted item.",
        "Solution Owners"
    ),
    ITEM_APPROVED(
        "Estimate item approved",
        "Notify when a reviewer approves one of your estimate items.",
        "Requesters"
    ),
    ITEM_REJECTED(
        "Estimate returned for revision",
        "Notify when a reviewer returns an item requiring changes.",
        "Requesters"
    ),
    ITEM_NEEDS_CLARIFICATION(
        "Clarification requested",
        "Notify when a reviewer asks you to clarify an estimate item.",
        "Requesters"
    ),
    ITEM_SENT_BACK(
        "Approval withdrawn",
        "Notify when an approved item is sent back for re-review.",
        "Requesters"
    ),
    REQUEST_SENT_TO_PRICING_REVIEW(
        "Estimate sent to pricing review",
        "Notify when your estimate moves into Client Pricing Review.",
        "Requesters & Revenue Managers"
    ),
    PRICING_REVIEW_READY(
        "New pricing review ready",
        "Notify when an estimate enters the Client Pricing Review queue.",
        "Revenue Managers"
    );

    public final String label;
    public final String description;
    public final String roleNote;

    NotificationType(String label, String description, String roleNote) {
        this.label = label;
        this.description = description;
        this.roleNote = roleNote;
    }
}
