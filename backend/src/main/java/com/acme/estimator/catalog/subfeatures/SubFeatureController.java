package com.acme.estimator.catalog.subfeatures;

import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.subfeatures.dto.CreateSubFeatureRequest;
import com.acme.estimator.catalog.subfeatures.dto.DeleteSubFeatureRequest;
import com.acme.estimator.catalog.subfeatures.dto.SubFeatureDetail;
import com.acme.estimator.catalog.subfeatures.dto.SubFeatureListItem;
import com.acme.estimator.catalog.subfeatures.dto.UpdateSubFeatureRequest;
import com.acme.estimator.catalog.templatefiles.CatalogTemplateFileService;
import com.acme.estimator.catalog.templatefiles.TemplateFileMeta;
import com.acme.estimator.common.ApiException;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Sub-features expose two URL surfaces:
 *
 * <ul>
 *   <li>{@code /api/catalog/products/{productId}/sub-features} — list +
 *       create (parent context required)</li>
 *   <li>{@code /api/catalog/sub-features/{id}} — direct read / update /
 *       activate / deactivate / delete / history</li>
 * </ul>
 *
 * Both branches live in this single controller class — the alternative
 * (one controller per URL prefix) would split closely-related code across
 * files for no real benefit.
 */
@RestController
// WEB-07: Revenue Manager has no catalog role — Admin + Solution Owner only;
// read endpoints re-open to REQUESTER individually where needed.
@PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")
@RequiredArgsConstructor
public class SubFeatureController {

    private final SubFeatureService subFeatureService;
    private final CatalogTemplateFileService templateFileService;
    private final UserRepository userRepository;

    // ---- under-product: list + create -------------------------------------

    @GetMapping("/api/catalog/products/{productId}/sub-features")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REQUESTER')")
    public List<SubFeatureListItem> listForProduct(@PathVariable Long productId) {
        return subFeatureService.listByProduct(productId);
    }

    @PostMapping("/api/catalog/products/{productId}/sub-features")
    public ResponseEntity<SubFeatureDetail> create(
        @PathVariable Long productId,
        @Valid @RequestBody CreateSubFeatureRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        SubFeatureDetail created = subFeatureService.create(productId, body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ---- by-id: direct CRUD -----------------------------------------------

    @GetMapping("/api/catalog/sub-features/{id}")
    public SubFeatureDetail get(@PathVariable Long id) {
        return subFeatureService.get(id);
    }

    @PatchMapping("/api/catalog/sub-features/{id}")
    public SubFeatureDetail update(
        @PathVariable Long id,
        @Valid @RequestBody UpdateSubFeatureRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return subFeatureService.update(id, body, currentUser(principal));
    }

    @PostMapping("/api/catalog/sub-features/{id}/activate")
    public SubFeatureDetail activate(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return subFeatureService.activate(id, currentUser(principal));
    }

    @PostMapping("/api/catalog/sub-features/{id}/deactivate")
    public SubFeatureDetail deactivate(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return subFeatureService.deactivate(id, currentUser(principal));
    }

    @DeleteMapping("/api/catalog/sub-features/{id}")
    public ResponseEntity<Void> delete(
        @PathVariable Long id,
        @Valid @RequestBody DeleteSubFeatureRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        subFeatureService.delete(id, body.confirmationName(), currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/catalog/sub-features/{id}/history")
    public List<ChangeLogEntry> history(@PathVariable Long id) {
        return subFeatureService.history(id);
    }

    // ---- template file ----------------------------------------------------

    @PostMapping("/api/catalog/sub-features/{id}/template-file")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")
    public TemplateFileMeta uploadTemplateFile(
        @PathVariable Long id,
        @RequestParam("file") MultipartFile file,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return templateFileService.uploadForSubFeature(id, file, currentUser(principal));
    }

    @DeleteMapping("/api/catalog/sub-features/{id}/template-file")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")
    public ResponseEntity<Void> deleteTemplateFile(
        @PathVariable Long id,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        templateFileService.deleteForSubFeature(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/catalog/sub-features/{id}/template-file/download")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ByteArrayResource> downloadTemplateFile(@PathVariable Long id) {
        var f = templateFileService.downloadForSubFeature(id);
        return ResponseEntity.ok()
            .header("Content-Disposition",
                ContentDisposition.attachment().filename(f.getOriginalFilename()).build().toString())
            .contentType(MediaType.parseMediaType(f.getContentType()))
            .contentLength(f.getFileSizeBytes())
            .body(new ByteArrayResource(f.getFileData()));
    }

    // ---- helpers ----------------------------------------------------------

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
