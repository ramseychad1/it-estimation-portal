package com.acme.estimator.catalog.categories;

import com.acme.estimator.catalog.categories.dto.CategoryDto;
import com.acme.estimator.catalog.categories.dto.CategoryRequest;
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
public class CategoryController {

    private final CategoryService service;

    /** Active-only — open to all authenticated users for form dropdowns. */
    @GetMapping("/api/catalog/categories")
    @PreAuthorize("isAuthenticated()")
    public List<CategoryDto> listActive() {
        return service.listActive();
    }

    /** Full list including inactive — Admin only. */
    @GetMapping("/api/admin/categories")
    @PreAuthorize("hasRole('ADMIN')")
    public List<CategoryDto> listAll() {
        return service.listAll();
    }

    @PostMapping("/api/admin/categories")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CategoryDto> create(@Valid @RequestBody CategoryRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body));
    }

    @PatchMapping("/api/admin/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public CategoryDto update(@PathVariable Long id, @Valid @RequestBody CategoryRequest body) {
        return service.update(id, body);
    }

    @DeleteMapping("/api/admin/categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
