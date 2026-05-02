package com.acme.estimator.estimates;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.SendBackRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only safety valve for the estimate-request workflow.
 *
 * <p>Today's only endpoint: send an Approved or Rejected request back
 * to Submitted so a different SO can re-review it. Lives on its own
 * controller (separate from {@link EstimateReviewController}'s
 * SOLUTION_OWNER gate) so the role check is unambiguous.
 */
@RestController
@RequestMapping("/api/estimates/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class EstimateAdminController {

    private final EstimateRequestService service;
    private final UserRepository userRepository;

    @PostMapping("/{id}/send-back")
    public EstimateRequestDetail sendBack(
        @PathVariable Long id,
        @Valid @RequestBody SendBackRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.sendBack(id, body, currentUser(principal));
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
