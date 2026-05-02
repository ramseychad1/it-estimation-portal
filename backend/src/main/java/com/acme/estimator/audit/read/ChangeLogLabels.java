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

    private static final Map<ChangeAction, String> ACTION_LABELS = Map.of(
        ChangeAction.CREATED, "Created",
        ChangeAction.UPDATED, "Updated",
        ChangeAction.ACTIVATED, "Activated",
        ChangeAction.DEACTIVATED, "Deactivated",
        ChangeAction.DELETED, "Deleted",
        ChangeAction.REORDERED, "Reordered",
        ChangeAction.PASSWORD_RESET, "Password Reset",
        ChangeAction.INVITATION_REVOKED, "Invitation Revoked",
        ChangeAction.INVITATION_ACCEPTED, "Invitation Accepted"
    );

    /**
     * Verbs in past tense, used inside descriptions like
     * "Sarah updated Team 'App Dev'". Includes a directional preposition
     * where one is needed ("reset password for", "revoked invitation for").
     */
    private static final Map<ChangeAction, String> ACTION_VERBS = Map.of(
        ChangeAction.CREATED, "created",
        ChangeAction.UPDATED, "updated",
        ChangeAction.ACTIVATED, "activated",
        ChangeAction.DEACTIVATED, "deactivated",
        ChangeAction.DELETED, "deleted",
        ChangeAction.REORDERED, "reordered",
        ChangeAction.PASSWORD_RESET, "reset password for",
        ChangeAction.INVITATION_REVOKED, "revoked invitation for",
        ChangeAction.INVITATION_ACCEPTED, "accepted invitation as"
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
}
