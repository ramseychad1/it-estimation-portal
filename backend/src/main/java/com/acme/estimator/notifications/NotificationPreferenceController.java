package com.acme.estimator.notifications;

import com.acme.estimator.auth.AppUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile/notifications")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class NotificationPreferenceController {

    private final NotificationPreferenceService service;

    @GetMapping
    public NotificationPrefsResponse get(@AuthenticationPrincipal AppUserDetails principal) {
        return service.getPrefs(principal.getUserId());
    }

    @PutMapping
    public NotificationPrefsResponse update(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestBody UpdateNotificationPrefsRequest body
    ) {
        return service.savePrefs(principal.getUserId(), body);
    }
}
