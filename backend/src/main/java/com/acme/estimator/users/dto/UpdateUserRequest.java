package com.acme.estimator.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Patch shape: every field optional. Null means "no change."
 *
 * The {@code active} flag is intentionally absent — flips of active status
 * go through the dedicated /activate and /deactivate endpoints so the
 * change_log records ACTIVATED / DEACTIVATED instead of UPDATED:active.
 */
public record UpdateUserRequest(
    @Size(max = 100) String firstName,
    @Size(max = 100) String lastName,
    @Email @Size(max = 255) String email,
    /**
     * If null, roles are unchanged. If empty list, the user is left with no
     * roles — controllers can't enforce "at least one" without making this
     * required. Last-admin protection still applies when this list omits Admin.
     */
    List<Short> roleIds
) {}
