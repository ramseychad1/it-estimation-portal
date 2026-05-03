package com.acme.estimator.catalog.products;

import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.dto.CreateProductRequest;
import com.acme.estimator.catalog.products.dto.DeleteProductRequest;
import com.acme.estimator.catalog.products.dto.ListProductsFilter;
import com.acme.estimator.catalog.products.dto.ProductDetail;
import com.acme.estimator.catalog.products.dto.ProductListItem;
import com.acme.estimator.catalog.products.dto.UpdateProductRequest;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/catalog/products")
@PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final UserRepository userRepository;

    @GetMapping
    public PageResponse<ProductListItem> list(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) ProductMode mode,
        @RequestParam(required = false, defaultValue = "ALL") String status,
        @RequestParam(required = false) Long teamId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @RequestParam(defaultValue = "name,asc") String sort
    ) {
        Boolean activeOnly = switch (status.toUpperCase()) {
            case "ACTIVE" -> Boolean.TRUE;
            case "INACTIVE" -> Boolean.FALSE;
            case "ALL" -> null;
            default -> throw ApiException.badRequest("Invalid status: " + status);
        };
        ListProductsFilter filter = new ListProductsFilter(search, mode, activeOnly, teamId);
        Sort sortSpec = parseSort(sort);
        Page<ProductListItem> result = productService.list(
            filter, PageRequest.of(page, size, sortSpec)
        );
        return PageResponse.from(result, x -> x);
    }

    @PostMapping
    public ResponseEntity<ProductDetail> create(
        @Valid @RequestBody CreateProductRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        ProductDetail created = productService.create(body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    public ProductDetail get(@PathVariable Long id) {
        return productService.get(id);
    }

    @PatchMapping("/{id}")
    public ProductDetail update(
        @PathVariable Long id,
        @Valid @RequestBody UpdateProductRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return productService.update(id, body, currentUser(principal));
    }

    @PostMapping("/{id}/activate")
    public ProductDetail activate(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return productService.activate(id, currentUser(principal));
    }

    @PostMapping("/{id}/deactivate")
    public ProductDetail deactivate(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return productService.deactivate(id, currentUser(principal));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @PathVariable Long id,
        @Valid @RequestBody DeleteProductRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        productService.delete(id, body.confirmationName(), currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/history")
    public List<ChangeLogEntry> history(@PathVariable Long id) {
        return productService.history(id);
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> export(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) ProductMode mode,
        @RequestParam(required = false, defaultValue = "ALL") String status
    ) {
        Boolean activeOnly = switch (status.toUpperCase()) {
            case "ACTIVE" -> Boolean.TRUE;
            case "INACTIVE" -> Boolean.FALSE;
            case "ALL" -> null;
            default -> throw ApiException.badRequest("Invalid status: " + status);
        };
        ProductService.ProductExport bundle = productService.listForExport(
            new ListProductsFilter(search, mode, activeOnly, null)
        );
        String filename = "products_export_" + LocalDate.now() + ".csv";
        StreamingResponseBody stream = out -> {
            try {
                ProductCsvWriter.write(out, bundle.products(), bundle.userNames());
            } catch (IOException e) {
                throw new IOException("CSV export failed", e);
            }
        };
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
            .body(stream);
    }

    // ---- helpers --------------------------------------------------------

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }

    private Sort parseSort(String raw) {
        if (raw == null || raw.isBlank()) return Sort.by("name").ascending();
        String[] parts = raw.split(",", 2);
        String prop = parts[0].trim();
        Sort.Direction dir = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(dir, prop);
    }
}
