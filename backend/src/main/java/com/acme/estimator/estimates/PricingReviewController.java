package com.acme.estimator.estimates;

import com.acme.estimator.common.PageLimits;
import com.acme.estimator.common.PageResponse;
import com.acme.estimator.estimates.dto.EstimateRequestDetail;
import com.acme.estimator.estimates.dto.EstimateRequestListItem;
import com.acme.estimator.estimates.dto.SavePricingReviewRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pricing-review")
@PreAuthorize("hasAnyRole('ADMIN','REVENUE_MANAGER')")
@RequiredArgsConstructor
public class PricingReviewController {

    private final EstimateRequestService estimateRequestService;
    private final PricingReviewService pricingReviewService;

    @GetMapping
    public PageResponse<EstimateRequestListItem> queue(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        Page<EstimateRequestListItem> result = estimateRequestService.pricingReviewQueue(
            PageLimits.of(page, size, Sort.by(Sort.Direction.ASC, "updatedAt"))
        );
        return PageResponse.from(result, x -> x);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EstimateRequestDetail> get(@PathVariable Long id) {
        return ResponseEntity.ok(pricingReviewService.getForReview(id));
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<EstimateRequestDetail> claim(@PathVariable Long id) {
        return ResponseEntity.ok(pricingReviewService.claim(id));
    }

    @PostMapping("/{id}/release")
    public ResponseEntity<EstimateRequestDetail> release(@PathVariable Long id) {
        return ResponseEntity.ok(pricingReviewService.release(id));
    }

    @PutMapping("/{id}/save")
    public ResponseEntity<EstimateRequestDetail> save(
        @PathVariable Long id,
        @RequestBody SavePricingReviewRequest dto
    ) {
        return ResponseEntity.ok(pricingReviewService.save(id, dto));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<EstimateRequestDetail> approve(
        @PathVariable Long id,
        @RequestBody SavePricingReviewRequest dto
    ) {
        return ResponseEntity.ok(pricingReviewService.approve(id, dto));
    }
}
