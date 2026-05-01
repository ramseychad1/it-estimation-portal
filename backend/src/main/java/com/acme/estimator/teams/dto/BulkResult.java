package com.acme.estimator.teams.dto;

import java.util.List;

/**
 * Per-row outcome for bulk operations. Each row gets its own transaction so
 * a partial failure does not roll back the rows that succeeded; the response
 * tells the caller which ids landed and which did not.
 *
 * The endpoint always returns 200 — the body is the truth of what happened.
 */
public record BulkResult(
    List<Long> succeeded,
    List<BulkFailure> failed
) {
    public record BulkFailure(Long id, String error, String message) {}
}
