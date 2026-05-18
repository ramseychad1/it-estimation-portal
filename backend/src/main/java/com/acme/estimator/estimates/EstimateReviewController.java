package com.acme.estimator.estimates;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import com.acme.estimator.estimates.dto.ApproveItemRequest;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.EstimateRequestListItem;
import com.acme.estimator.estimates.dto.ListReviewQueueFilter;
import com.acme.estimator.estimates.dto.RejectItemRequest;
import com.acme.estimator.estimates.dto.RequestClarificationRequest;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Solution Owner review surface — Phase 9b per-item review.
 *
 * <p>Each item in a multi-product request is reviewed independently by
 * an SO whose team owns the item's product. The queue and detail reads
 * remain request-level; actions are scoped to a specific item.
 *
 * <p>Role gate: Admin or Solution Owner. Runtime checks in the service
 * enforce team-scoping and reviewer-ownership.
 */
@RestController
@RequestMapping("/api/estimates/review")
@PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")
@RequiredArgsConstructor
public class EstimateReviewController {

    private final EstimateRequestService service;
    private final UserRepository userRepository;

    // ---- queue + detail reads (request-level) ----------------------------

    @GetMapping
    public PageResponse<EstimateRequestListItem> queue(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Long productId,
        @RequestParam(required = false) Long teamId,
        @RequestParam(required = false, defaultValue = "false") boolean mineOnly,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        Sort sort = Sort.by(Sort.Direction.ASC, "id");
        var filter = new ListReviewQueueFilter(status, search, productId, teamId, mineOnly);
        Page<EstimateRequestListItem> result = service.reviewQueue(
            filter, PageRequest.of(page, size, sort), currentUser(principal)
        );
        return PageResponse.from(result, x -> x);
    }

    @GetMapping("/{requestId}")
    public EstimateRequestDetail get(
        @PathVariable Long requestId, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.getForReview(requestId, currentUser(principal));
    }

    // ---- per-item review actions -----------------------------------------

    @PostMapping("/{requestId}/items/{itemId}/start")
    public EstimateRequestDetail start(
        @PathVariable Long requestId,
        @PathVariable Long itemId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.startItemReview(requestId, itemId, currentUser(principal));
    }

    @PostMapping("/{requestId}/items/{itemId}/release")
    public EstimateRequestDetail release(
        @PathVariable Long requestId,
        @PathVariable Long itemId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.releaseItemReview(requestId, itemId, currentUser(principal));
    }

    @PostMapping("/{requestId}/items/{itemId}/approve")
    public EstimateRequestDetail approve(
        @PathVariable Long requestId,
        @PathVariable Long itemId,
        @Valid @RequestBody ApproveItemRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.approveItem(requestId, itemId, body, currentUser(principal));
    }

    @PostMapping("/{requestId}/items/{itemId}/reject")
    public EstimateRequestDetail reject(
        @PathVariable Long requestId,
        @PathVariable Long itemId,
        @Valid @RequestBody RejectItemRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.rejectItem(requestId, itemId, body, currentUser(principal));
    }

    @PostMapping("/{requestId}/items/{itemId}/request-clarification")
    public EstimateRequestDetail requestClarification(
        @PathVariable Long requestId,
        @PathVariable Long itemId,
        @Valid @RequestBody RequestClarificationRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.requestClarification(requestId, itemId, body, currentUser(principal));
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
