package com.acme.estimator.settings;

import com.acme.estimator.auth.User;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/settings")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AppSettingController {

    private final AppSettingService service;

    @GetMapping
    public ResponseEntity<Map<String, String>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @PutMapping
    public ResponseEntity<Map<String, String>> update(
        @RequestBody Map<String, String> updates,
        @AuthenticationPrincipal User actor
    ) {
        return ResponseEntity.ok(service.setAll(updates, actor));
    }
}
