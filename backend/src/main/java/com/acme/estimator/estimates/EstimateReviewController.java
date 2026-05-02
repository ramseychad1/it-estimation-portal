package com.acme.estimator.estimates;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.EstimateRequestListItem;
import com.acme.estimator.estimates.dto.ListReviewQueueFilter;
import com.acme.estimator.estimates.dto.RejectRequest;
import com.acme.estimator.estimates.dto.SaveReviewStateRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Solution Owner review surface. All endpoints require the SOLUTION_OWNER
 * role; runtime ownership checks (only the current reviewer can approve /
 * reject / release / save state) live in the service.
 *
 * <p>Multi-role users are supported (an Admin who is also an SO can hit
 * these endpoints). The Admin send-back path is on a separate
 * controller with its own role gate.
 */
@RestController
@RequestMapping("/api/estimates/review")
@PreAuthorize("hasRole('SOLUTION_OWNER')")
@RequiredArgsConstructor
public class EstimateReviewController {

    private final EstimateRequestService service;
    private final UserRepository userRepository;

    @GetMapping
    public PageResponse<EstimateRequestListItem> queue(
        @RequestParam(required = false) EstimateStatus status,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Long productId,
        @RequestParam(required = false, defaultValue = "false") boolean mineOnly,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        // Sort: oldest-submitted first (FIFO queue) by default. Sort
        // override is intentionally not exposed yet — keep the queue
        // semantics simple until the SO population grows.
        Sort sort = Sort.by(Sort.Direction.ASC, "submittedAt").and(Sort.by(Sort.Direction.ASC, "id"));
        var filter = new ListReviewQueueFilter(status, search, productId, mineOnly);
        Page<EstimateRequestListItem> result = service.reviewQueue(
            filter, PageRequest.of(page, size, sort), currentUser(principal)
        );
        return PageResponse.from(result, x -> x);
    }

    @GetMapping("/{id}")
    public EstimateRequestDetail get(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.getForReview(id, currentUser(principal));
    }

    @PostMapping("/{id}/start")
    public EstimateRequestDetail start(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.startReview(id, currentUser(principal));
    }

    @PostMapping("/{id}/release")
    public EstimateRequestDetail release(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.releaseReview(id, currentUser(principal));
    }

    @PutMapping("/{id}/state")
    public EstimateRequestDetail saveState(
        @PathVariable Long id,
        @Valid @RequestBody SaveReviewStateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.saveReviewState(id, body, currentUser(principal));
    }

    @PostMapping("/{id}/approve")
    public EstimateRequestDetail approve(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.approve(id, currentUser(principal));
    }

    @PostMapping("/{id}/reject")
    public EstimateRequestDetail reject(
        @PathVariable Long id,
        @Valid @RequestBody RejectRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.reject(id, body, currentUser(principal));
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
