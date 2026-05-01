package com.acme.estimator.audit;

/**
 * Where the change originated. WEB is the only producer for now; API + SYSTEM
 * are placeholders for future external automation and bootstrap jobs.
 */
public enum ChangeSource {
    WEB,
    API,
    SYSTEM
}
