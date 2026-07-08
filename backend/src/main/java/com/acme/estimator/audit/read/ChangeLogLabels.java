package com.acme.estimator.audit.read;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.estimates.EstimateRequest;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.teams.Team;
import com.acme.estimator.users.UserService;
import java.util.Map;

/**
 * Static label mappings for entity types and actions.
 *
 * The frontend renders the labels verbatim, so the source of truth lives
 * here — one less rendering rule for the React layer to keep in sync.
 */
public final class ChangeLogLabels {

    private ChangeLogLabels() {}

    private static final Map<String, String> ENTITY_LABELS = Map.ofEntries(
        Map.entry(Team.ENTITY_TYPE, "Team"),
        Map.entry(SdlcPhase.ENTITY_TYPE, "SDLC Phase"),
        Map.entry(BlendedRate.ENTITY_TYPE, "Blended Rate"),
        Map.entry(UserService.ENTITY_TYPE, "User"),
        Map.entry(Product.ENTITY_TYPE, "Product"),
        Map.entry(SubFeature.ENTITY_TYPE, "Sub-feature"),
        Map.entry(CriticalQuestion.ENTITY_TYPE, "Critical Question"),
        Map.entry(EstimateTemplate.ENTITY_TYPE, "Estimate template"),
        Map.entry(EstimateRequest.ENTITY_TYPE, "Estimate request")
    );

    private static final Map<ChangeAction, String> ACTION_LABELS = Map.ofEntries(
        Map.entry(ChangeAction.CREATED, "Created"),
        Map.entry(ChangeAction.UPDATED, "Updated"),
        Map.entry(ChangeAction.ACTIVATED, "Activated"),
        Map.entry(ChangeAction.DEACTIVATED, "Deactivated"),
        Map.entry(ChangeAction.DELETED, "Deleted"),
        Map.entry(ChangeAction.REORDERED, "Reordered"),
        Map.entry(ChangeAction.PASSWORD_RESET, "Password Reset"),
        Map.entry(ChangeAction.INVITATION_REVOKED, "Invitation Revoked"),
        Map.entry(ChangeAction.INVITATION_ACCEPTED, "Invitation Accepted"),
        // Phase 6b — estimate-request workflow
        Map.entry(ChangeAction.SUBMITTED, "Submitted"),
        Map.entry(ChangeAction.REVIEW_STARTED, "Review Started"),
        Map.entry(ChangeAction.REVIEW_RELEASED, "Review Released"),
        Map.entry(ChangeAction.APPROVED, "Approved"),
        Map.entry(ChangeAction.REJECTED, "Rejected"),
        Map.entry(ChangeAction.SENT_BACK, "Sent Back")
    );

    /**
     * Verbs in past tense, used inside descriptions like
     * "Sarah updated Team 'App Dev'". Includes a directional preposition
     * where one is needed ("reset password for", "revoked invitation for",
     * "started review of").
     */
    private static final Map<ChangeAction, String> ACTION_VERBS = Map.ofEntries(
        Map.entry(ChangeAction.CREATED, "created"),
        Map.entry(ChangeAction.UPDATED, "updated"),
        Map.entry(ChangeAction.ACTIVATED, "activated"),
        Map.entry(ChangeAction.DEACTIVATED, "deactivated"),
        Map.entry(ChangeAction.DELETED, "deleted"),
        Map.entry(ChangeAction.REORDERED, "reordered"),
        Map.entry(ChangeAction.PASSWORD_RESET, "reset password for"),
        Map.entry(ChangeAction.INVITATION_REVOKED, "revoked invitation for"),
        Map.entry(ChangeAction.INVITATION_ACCEPTED, "accepted invitation as"),
        // Phase 6b — directional verbs that read naturally inside the
        // change-log feed alongside the entity name. "started review of"
        // and "sent…back for re-review" are the awkward ones; everything
        // else is a one-word past tense.
        Map.entry(ChangeAction.SUBMITTED, "submitted"),
        Map.entry(ChangeAction.REVIEW_STARTED, "started review of"),
        Map.entry(ChangeAction.REVIEW_RELEASED, "released"),
        Map.entry(ChangeAction.APPROVED, "approved"),
        Map.entry(ChangeAction.REJECTED, "rejected"),
        Map.entry(ChangeAction.SENT_BACK, "sent back for re-review"),
        // UX-4 — per-item actions (Phase 9b) had no verbs, so change-log
        // rows rendered as "Actor EstimateRequest 'title'" with no verb at
        // all. The entity is always the parent request; the item context
        // lives in the notes column.
        Map.entry(ChangeAction.ITEM_REVIEW_STARTED, "started reviewing an item on"),
        Map.entry(ChangeAction.ITEM_REVIEW_RELEASED, "released an item review on"),
        Map.entry(ChangeAction.ITEM_REVIEW_TAKEN_OVER, "took over an item review on"),
        Map.entry(ChangeAction.ITEM_APPROVED, "approved an item on"),
        Map.entry(ChangeAction.ITEM_REJECTED, "rejected an item on"),
        Map.entry(ChangeAction.ITEM_REVISED, "revised an item on"),
        Map.entry(ChangeAction.ITEM_RESUBMITTED, "resubmitted an item on"),
        Map.entry(ChangeAction.ITEM_DROPPED, "removed an item from"),
        Map.entry(ChangeAction.ITEM_SENT_BACK, "sent an item back on"),
        Map.entry(ChangeAction.ITEM_CLARIFICATION_REQUESTED, "requested clarification on"),
        Map.entry(ChangeAction.ITEM_CLARIFICATION_ANSWERED, "answered a clarification on"),
        Map.entry(ChangeAction.ITEM_RECALLED, "recalled an item on"),
        Map.entry(ChangeAction.PRICING_REVIEW_STARTED, "started pricing review of"),
        Map.entry(ChangeAction.PRICING_REVIEW_RELEASED, "released pricing review of"),
        Map.entry(ChangeAction.PRICING_REVIEW_APPROVED, "approved pricing for"),
        Map.entry(ChangeAction.PRICING_REVIEW_REQUESTED, "queued pricing review for"),
        Map.entry(ChangeAction.SETTING_UPDATED, "updated")
    );

    public static String forEntityType(String entityType) {
        return ENTITY_LABELS.getOrDefault(entityType, entityType);
    }

    public static String forAction(ChangeAction action) {
        return ACTION_LABELS.getOrDefault(action, action.name());
    }

    public static String verbFor(ChangeAction action) {
        return ACTION_VERBS.getOrDefault(action, action.name().toLowerCase());
    }

    /**
     * Every ChangeAction must have an explicit verb — the fallback in
     * {@link #verbFor} renders raw enum text ("item_review_started") in
     * user-facing descriptions. Guarded by a unit test so new enum values
     * can't ship without one.
     */
    static boolean hasExplicitVerb(ChangeAction action) {
        return ACTION_VERBS.containsKey(action);
    }
}
