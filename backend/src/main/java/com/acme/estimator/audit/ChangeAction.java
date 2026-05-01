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
    REORDERED
}
