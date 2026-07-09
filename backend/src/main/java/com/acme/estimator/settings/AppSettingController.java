package com.acme.estimator.settings;

import com.acme.estimator.notifications.EmailService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    private final EmailService emailService;

    @GetMapping
    public ResponseEntity<Map<String, String>> getAll() {
        // SEC-2: secret values are masked — never echo credentials to the client.
        return ResponseEntity.ok(service.getAllForDisplay());
    }

    @PutMapping
    public ResponseEntity<Map<String, String>> update(@RequestBody Map<String, String> updates) {
        return ResponseEntity.ok(service.setAll(updates));
    }

    record TestEmailRequest(@NotBlank @Email String toAddress) {}

    @PostMapping("/test-email")
    public ResponseEntity<Void> testEmail(@Valid @RequestBody TestEmailRequest req) {
        emailService.sendTestEmail(req.toAddress());
        return ResponseEntity.noContent().build();
    }
}
