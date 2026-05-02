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
 * authority and can hit these endpoints. Within the service, individual
 * GETs are scoped to "owner OR admin" via {@code loadVisibleRequest};
 * mutations on Drafts (PATCH / submit / discard / saveDraftAnswers) stay
 * strictly owner-only — Admin can VIEW everything but cannot
 * EDIT-AS-USER.
 *
 * <p>The Reviewer surface (Phase 6b) lives at a separate route prefix
 * with its own role check.
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
        @RequestParam(required = false) EstimateStatus status,
        @RequestParam(required = false) String search,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        // Sort by createdAt DESC at the controller level so the
        // service-layer Specification stays sort-agnostic.
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

    @PutMapping("/{id}/answers")
    public EstimateRequestDetail saveAnswers(
        @PathVariable Long id,
        @Valid @RequestBody SaveAnswersRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.saveDraftAnswers(id, body, currentUser(principal));
    }

    @PostMapping("/{id}/submit")
    public EstimateRequestDetail submit(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return service.submit(id, currentUser(principal));
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
