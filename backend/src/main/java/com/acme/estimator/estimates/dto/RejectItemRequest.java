package com.acme.estimator.estimates.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Payload for rejecting a single estimate-request item.
 *
 * <p>The rejection reason is required — an SO must explain why so the
 * requester knows what to revise. Stored on the item and surfaced to
 * the requester on their detail page.
 */
public record RejectItemRequest(
    @NotBlank @Size(max = 4000) String rejectionReason
) {}
