package com.acme.estimator.audit.read;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.users.UserService;

/**
 * Renders the human-facing description string for a change-log group.
 *
 * Factored out so a future "user resets their own password" case can
 * reuse the self-action phrasing without re-deriving the rule. The same
 * helper covers {@code INVITATION_ACCEPTED} (where {@code changed_by ==
 * entity_id} on a {@code User} row) — that case already exists today.
 */
public final class DescriptionFormatter {

    private DescriptionFormatter() {}

    /**
     * @param actorName     the actor's display name
     * @param actorId       used to detect self-actions on User rows
     * @param action        the change action
     * @param entityType    raw {@code entity_type} (e.g. "Team")
     * @param entityId      used for self-action detection
     * @param entityName    resolved entity name (or "Deleted ..." placeholder)
     */
    public static String render(
        String actorName,
        Long actorId,
        ChangeAction action,
        String entityType,
        Long entityId,
        String entityName
    ) {
        if (isSelfAction(action, entityType, actorId, entityId)) {
            return formatSelfAction(actorName, action);
        }
        String typeLabel = ChangeLogLabels.forEntityType(entityType);
        // SENT_BACK is split — the verb wraps around the entity name
        // ("Sarah sent Estimate request 'X' back for re-review"). The
        // default {actor} {verb} {type} {name} template would render it
        // as "Sarah sent back for re-review Estimate request 'X'", which
        // is grammatically wrong. Special-cased here rather than baking
        // the wrap-around into ChangeLogLabels because it's the only
        // verb that needs the split today.
        if (action == ChangeAction.SENT_BACK) {
            return actorName + " sent " + typeLabel + " '" + entityName + "' back for re-review";
        }
        String verb = ChangeLogLabels.verbFor(action);
        return actorName + " " + verb + " " + typeLabel + " '" + entityName + "'";
    }

    private static boolean isSelfAction(
        ChangeAction action, String entityType, Long actorId, Long entityId
    ) {
        if (!UserService.ENTITY_TYPE.equals(entityType)) return false;
        if (actorId == null || entityId == null) return false;
        return actorId.equals(entityId);
    }

    private static String formatSelfAction(String actorName, ChangeAction action) {
        return switch (action) {
            case INVITATION_ACCEPTED -> actorName + " accepted their invitation";
            case PASSWORD_RESET      -> actorName + " reset their password";
            default -> actorName + " " + ChangeLogLabels.verbFor(action) + " their account";
        };
    }
}
