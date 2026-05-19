package com.acme.estimator.catalog.programtypes;

import com.acme.estimator.catalog.programtypes.dto.ProgramTypeDto;
import com.acme.estimator.catalog.programtypes.dto.ProgramTypeRequest;
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
public class ProgramTypeController {

    private final ProgramTypeService service;

    /** Active-only — open to all authenticated users for form dropdowns. */
    @GetMapping("/api/catalog/program-types")
    @PreAuthorize("isAuthenticated()")
    public List<ProgramTypeDto> listActive() {
        return service.listActive();
    }

    /** Full list including inactive — Admin only. */
    @GetMapping("/api/admin/program-types")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ProgramTypeDto> listAll() {
        return service.listAll();
    }

    @PostMapping("/api/admin/program-types")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProgramTypeDto> create(@Valid @RequestBody ProgramTypeRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body));
    }

    @PatchMapping("/api/admin/program-types/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ProgramTypeDto update(@PathVariable Long id, @Valid @RequestBody ProgramTypeRequest body) {
        return service.update(id, body);
    }

    @DeleteMapping("/api/admin/program-types/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
