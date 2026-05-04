package com.acme.estimator.estimates;

import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import java.util.List;
import com.acme.estimator.estimates.dto.CreateDraftRequest;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.EstimateRequestListItem;
import com.acme.estimator.estimates.dto.ReviseAndResubmitRequest;
import com.acme.estimator.estimates.dto.SaveAnswersRequest;
import com.acme.estimator.estimates.dto.UpdateDraftRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Requester surface for estimate requests.
 *
 * <p>Phase 7.5 broadens the role gate from {@code hasRole('REQUESTER')}
 * to {@code hasAnyRole('ADMIN','REQUESTER')}: Admins inherit Requester
 * authority.
 *
 * <p>Phase 9a: the list endpoint's {@code status} parameter is now a
 * {@code String} to support derived statuses (PARTIALLY_APPROVED,
 * NEEDS_REVISION) that don't exist in {@link EstimateStatus}.
 */
@RestController
@RequestMapping("/api/estimates/my")
@PreAuthorize("hasAnyRole('ADMIN','REQUESTER')")
@RequiredArgsConstructor
public class EstimateRequestController {

    private final EstimateRequestService service;
    private final UserRepository userRepository;

    @GetMapping
    public PageResponse<EstimateRequestListItem> list(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        org.springframework.data.domain.Sort sort =
            org.springframework.data.domain.Sort.by("createdAt").descending();
        Page<EstimateRequestListItem> result = service.myRequests(
            PageRequest.of(page, size, sort), status, search, currentUser(principal)
        );
        return PageResponse.from(result, x -> x);
    }

    @PostMapping
    public ResponseEntity<EstimateRequestDetail> create(
        @Valid @RequestBody CreateDraftRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        EstimateRequestDetail created = service.createDraft(body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    public EstimateRequestDetail get(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.getMyRequest(id, currentUser(principal));
    }

    @PatchMapping("/{id}")
    public EstimateRequestDetail patch(
        @PathVariable Long id,
        @Valid @RequestBody UpdateDraftRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.updateDraft(id, body, currentUser(principal));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> discard(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        service.discard(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    /**
     * Backward-compatible: saves answers for the first item of a Draft.
     * Phase 9a: use PUT /{id}/items/{itemId}/answers for per-item control.
     */
    @PutMapping("/{id}/answers")
    public EstimateRequestDetail saveAnswers(
        @PathVariable Long id,
        @Valid @RequestBody SaveAnswersRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.saveDraftAnswers(id, body, currentUser(principal));
    }

    /**
     * Per-item answer save. Phase 9a new endpoint.
     */
    @PutMapping("/{id}/items/{itemId}/answers")
    public EstimateRequestDetail saveItemAnswers(
        @PathVariable Long id,
        @PathVariable Long itemId,
        @Valid @RequestBody SaveAnswersRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.saveDraftItemAnswers(id, itemId, body, currentUser(principal));
    }

    @PostMapping("/{id}/submit")
    public EstimateRequestDetail submit(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.submit(id, currentUser(principal));
    }

    /** Combined revise + resubmit for a single REJECTED item. */
    @PostMapping("/{id}/items/{itemId}/revise-and-resubmit")
    public EstimateRequestDetail reviseAndResubmit(
        @PathVariable Long id,
        @PathVariable Long itemId,
        @Valid @RequestBody ReviseAndResubmitRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.reviseAndResubmitItem(id, itemId, body, currentUser(principal));
    }

    /** Drop a single REJECTED item from the request. Returns the updated request. */
    @DeleteMapping("/{id}/items/{itemId}")
    public EstimateRequestDetail dropItem(
        @PathVariable Long id,
        @PathVariable Long itemId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.dropItem(id, itemId, currentUser(principal));
    }

    @GetMapping("/{id}/history")
    public List<ChangeLogEntry> history(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.myRequestHistory(id, currentUser(principal));
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
