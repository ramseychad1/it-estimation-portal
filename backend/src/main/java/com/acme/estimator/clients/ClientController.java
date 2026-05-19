package com.acme.estimator.clients;

import com.acme.estimator.clients.dto.ClientDto;
import com.acme.estimator.clients.dto.ClientRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ClientController {

    private final ClientService service;

    /** Active clients — open to all authenticated users for form dropdowns. */
    @GetMapping("/api/catalog/clients")
    @PreAuthorize("isAuthenticated()")
    public List<ClientDto> listActive() {
        return service.listActive();
    }

    /** Full list including inactive — Admin only. */
    @GetMapping("/api/admin/clients")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ClientDto> listAll() {
        return service.listAll();
    }

    @PostMapping("/api/admin/clients")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ClientDto> create(@Valid @RequestBody ClientRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body));
    }

    @PatchMapping("/api/admin/clients/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ClientDto update(@PathVariable Long id, @Valid @RequestBody ClientRequest body) {
        return service.update(id, body);
    }

    @DeleteMapping("/api/admin/clients/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
