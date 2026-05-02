package com.acme.estimator.dashboard;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.common.PageResponse;
import com.acme.estimator.dashboard.dto.ActivityFeedItem;
import com.acme.estimator.dashboard.dto.DashboardSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Dashboard endpoints — both authenticated-only.
 *
 * <p>{@code /summary} returns the role-filtered stat cards; {@code /activity}
 * returns the role-filtered audit feed. Both reuse existing persistence
 * (Phases 4 + 6a/6b) — see {@link DashboardService}.
 *
 * <p>Class-level {@code isAuthenticated()} guard means anonymous → 401.
 * Per-role visibility happens inside the service so the controller stays
 * thin.
 */
@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/summary")
    public DashboardSummary summary(@AuthenticationPrincipal AppUserDetails me) {
        return dashboardService.getSummary(me.getUser());
    }

    @GetMapping("/activity")
    public PageResponse<ActivityFeedItem> activity(
        @RequestParam(defaultValue = "false") boolean mineOnly,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @AuthenticationPrincipal AppUserDetails me
    ) {
        return PageResponse.from(
            dashboardService.getActivity(mineOnly, page, size, me.getUser()),
            item -> item
        );
    }
}
