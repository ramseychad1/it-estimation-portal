package com.acme.estimator.audit.read;

import static org.assertj.core.api.Assertions.assertThat;

import com.acme.estimator.audit.ChangeAction;
import org.junit.jupiter.api.Test;

class ChangeLogLabelsTest {

    /**
     * UX-4 regression guard: 17 item-level and pricing actions shipped
     * without verbs, so change-log rows rendered with no verb at all.
     * Every enum value must carry an explicit verb.
     */
    @Test
    void everyChangeActionHasAnExplicitVerb() {
        for (ChangeAction action : ChangeAction.values()) {
            assertThat(ChangeLogLabels.hasExplicitVerb(action))
                .as("ChangeAction.%s needs an ACTION_VERBS entry in ChangeLogLabels "
                    + "— the fallback renders the raw enum name in user-facing text", action)
                .isTrue();
        }
    }

    @Test
    void verbsReadNaturallyInsideDescriptions() {
        assertThat(ChangeLogLabels.verbFor(ChangeAction.ITEM_REVIEW_TAKEN_OVER))
            .isEqualTo("took over an item review on");
        assertThat(ChangeLogLabels.verbFor(ChangeAction.ITEM_APPROVED))
            .isEqualTo("approved an item on");
    }
}
