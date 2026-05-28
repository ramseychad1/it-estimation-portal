package com.acme.estimator.estimates;

import com.acme.estimator.audit.AuditService;
import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.RmItemOverrideInput;
import com.acme.estimator.estimates.dto.SavePricingReviewRequest;
import com.acme.estimator.notifications.PricingReviewApprovedEvent;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Revenue Manager pricing review workflow (write side).
 *
 * <p>Queue reads are handled by {@link EstimateRequestService#pricingReviewQueue}.
 *
 * <p>State machine for {@code estimate_requests.pricing_review_status}:
 * <ul>
 *   <li>PENDING → claim → IN_REVIEW</li>
 *   <li>IN_REVIEW → release → PENDING</li>
 *   <li>IN_REVIEW → approve → APPROVED (request returns "APPROVED" derived status)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PricingReviewService {

    private final EstimateRequestRepository requestRepository;
    private final EstimateRequestItemRepository itemRepository;
    private final AuditService auditService;
    private final EstimateRequestService estimateRequestService;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    // ---- reads ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public EstimateRequestDetail getForReview(Long requestId) {
        User actor = currentUser();
        EstimateRequest request = loadPricingReviewRequest(requestId);
        return estimateRequestService.toDetail(request, actor);
    }

    // ---- writes --------------------------------------------------------------

    @Transactional
    public EstimateRequestDetail claim(Long requestId) {
        User actor = currentUser();
        EstimateRequest request = loadPricingReviewRequest(requestId);
        if (!"PENDING".equals(request.getPricingReviewStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE",
                "Only PENDING requests can be claimed for pricing review.");
        }
        request.setPricingReviewStatus("IN_REVIEW");
        request.setRmReviewerId(actor.getId());
        requestRepository.save(request);
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId,
            ChangeAction.PRICING_REVIEW_STARTED, actor,
            "Revenue Manager claimed '" + request.getTitle() + "' for pricing review."
        );
        return estimateRequestService.toDetail(request, actor);
    }

    @Transactional
    public EstimateRequestDetail release(Long requestId) {
        User actor = currentUser();
        EstimateRequest request = requireInReviewByActor(requestId, actor);
        request.setPricingReviewStatus("PENDING");
        request.setRmReviewerId(null);
        requestRepository.save(request);
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId,
            ChangeAction.PRICING_REVIEW_RELEASED, actor,
            "Revenue Manager released '" + request.getTitle() + "' back to the pricing review queue."
        );
        return estimateRequestService.toDetail(request, actor);
    }

    @Transactional
    public EstimateRequestDetail save(Long requestId, SavePricingReviewRequest dto) {
        User actor = currentUser();
        EstimateRequest request = requireInReviewByActor(requestId, actor);
        applyOverrides(request, dto);
        requestRepository.save(request);
        return estimateRequestService.toDetail(request, actor);
    }

    @Transactional
    public EstimateRequestDetail approve(Long requestId, SavePricingReviewRequest dto) {
        User actor = currentUser();
        EstimateRequest request = requireInReviewByActor(requestId, actor);
        applyOverrides(request, dto);
        request.setPricingReviewStatus("APPROVED");
        request.setRmReviewedAt(OffsetDateTime.now());
        requestRepository.save(request);
        auditService.recordAction(
            EstimateRequest.ENTITY_TYPE, requestId,
            ChangeAction.PRICING_REVIEW_APPROVED, actor,
            "Revenue Manager approved pricing review for '" + request.getTitle() + "'."
                + (dto.discountPct() != null ? " Discount: " + dto.discountPct() + "%." : "")
        );
        User requester = userRepository.findById(request.getRequesterId()).orElse(null);
        eventPublisher.publishEvent(new PricingReviewApprovedEvent(
            requestId, request.getTitle(), requester
        ));
        return estimateRequestService.toDetail(request, actor);
    }

    // ---- helpers -------------------------------------------------------------

    private User currentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof AppUserDetails d) return d.getUser();
        throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Not authenticated.");
    }

    private EstimateRequest loadPricingReviewRequest(Long requestId) {
        EstimateRequest request = requestRepository.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Estimate request " + requestId + " not found."));
        if (request.getPricingReviewStatus() == null) {
            throw ApiException.notFound("Estimate request " + requestId + " not found.");
        }
        return request;
    }

    private EstimateRequest requireInReviewByActor(Long requestId, User actor) {
        EstimateRequest request = loadPricingReviewRequest(requestId);
        if (!"IN_REVIEW".equals(request.getPricingReviewStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE",
                "Request is not currently in pricing review.");
        }
        if (!actor.isAdmin() && !actor.getId().equals(request.getRmReviewerId())) {
            throw ApiException.notFound("Estimate request " + requestId + " not found.");
        }
        return request;
    }

    private void applyOverrides(EstimateRequest request, SavePricingReviewRequest dto) {
        request.setRmDiscountPct(dto.discountPct());
        request.setRmNotes(dto.notes());

        if (dto.itemOverrides() == null || dto.itemOverrides().isEmpty()) return;

        List<EstimateRequestItem> items = itemRepository
            .findByEstimateRequestIdOrderByDisplayOrderAsc(request.getId());
        Map<Long, EstimateRequestItem> byId = items.stream()
            .collect(Collectors.toMap(EstimateRequestItem::getId, i -> i));

        List<EstimateRequestItem> toSave = new java.util.ArrayList<>();
        for (RmItemOverrideInput ov : dto.itemOverrides()) {
            EstimateRequestItem item = byId.get(ov.itemId());
            if (item == null) continue;
            item.setRmPricingModel(ov.pricingModel());
            item.setRmTmMultiplier(ov.tmMultiplier());
            item.setRmTmTargetMarginPct(ov.tmTargetMarginPct());
            item.setRmMatBillableRate(ov.matBillableRate());
            item.setRmMatDiscountPct(ov.matDiscountPct());
            toSave.add(item);
        }
        itemRepository.saveAll(toSave);
    }
}
