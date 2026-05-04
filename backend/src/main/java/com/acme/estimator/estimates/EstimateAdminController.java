package com.acme.estimator.estimates;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.SendBackRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only safety valve for the per-item review workflow.
 *
 * <p>Phase 9b M3: send-back is now per-item. Only APPROVED items can be sent back
 * to SUBMITTED; REJECTED items are handled by the requester via revise-and-resubmit or drop.
 */
@RestController
@RequestMapping("/api/estimates/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class EstimateAdminController {

    private final EstimateRequestService service;
    private final UserRepository userRepository;

    @PostMapping("/{requestId}/items/{itemId}/send-back")
    public EstimateRequestDetail sendBackItem(
        @PathVariable Long requestId,
        @PathVariable Long itemId,
        @Valid @RequestBody SendBackRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.sendBackItem(requestId, itemId, body, currentUser(principal));
    }

    @DeleteMapping("/{requestId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRequest(
        @PathVariable Long requestId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        service.deleteRequest(requestId, currentUser(principal));
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
