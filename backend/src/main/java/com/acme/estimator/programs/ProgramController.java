package com.acme.estimator.programs;

import com.acme.estimator.programs.dto.ProgramDto;
import com.acme.estimator.programs.dto.ProgramRequest;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ProgramController {

    private final ProgramService service;

    /** Active programs — open to all authenticated users. Optional clientId filter. */
    @GetMapping("/api/catalog/programs")
    @PreAuthorize("isAuthenticated()")
    public List<ProgramDto> listActive(@RequestParam(required = false) Long clientId) {
        return service.listActive(clientId);
    }

    /** Full list including inactive — Admin only. Optional clientId filter. */
    @GetMapping("/api/admin/programs")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ProgramDto> listAll(@RequestParam(required = false) Long clientId) {
        return service.listAll(clientId);
    }

    @PostMapping("/api/admin/programs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProgramDto> create(@Valid @RequestBody ProgramRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body));
    }

    @PatchMapping("/api/admin/programs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProgramDto update(@PathVariable Long id, @Valid @RequestBody ProgramRequest body) {
        return service.update(id, body);
    }

    @DeleteMapping("/api/admin/programs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
