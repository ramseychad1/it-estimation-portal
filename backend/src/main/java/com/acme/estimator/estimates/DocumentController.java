package com.acme.estimator.estimates;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.AttachmentMeta;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final UserRepository userRepository;

    /** Upload a new attachment for a question on a DRAFT item. Multiple files allowed. */
    @PostMapping("/estimates/items/{itemId}/answers/{questionId}/document")
    @PreAuthorize("hasAnyRole('REQUESTER','ADMIN')")
    public AttachmentMeta upload(
        @PathVariable Long itemId,
        @PathVariable Long questionId,
        @RequestParam("file") MultipartFile file,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return documentService.upload(itemId, questionId, file, currentUser(principal));
    }

    /** Delete a specific attachment by ID. Only the request owner may delete, only in DRAFT. */
    @DeleteMapping("/documents/{attachmentId}")
    @PreAuthorize("hasAnyRole('REQUESTER','ADMIN')")
    public ResponseEntity<Void> delete(
        @PathVariable Long attachmentId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        documentService.delete(attachmentId, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    /** Stream the file to the browser. Accessible to the request owner, any SO, and any Admin. */
    @GetMapping("/documents/{attachmentId}/download")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ByteArrayResource> download(
        @PathVariable Long attachmentId,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        AnswerAttachment attachment = documentService.download(attachmentId, currentUser(principal));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(
            ContentDisposition.attachment()
                .filename(attachment.getOriginalFilename())
                .build()
        );

        return ResponseEntity.ok()
            .headers(headers)
            .contentType(MediaType.parseMediaType(attachment.getContentType()))
            .contentLength(attachment.getFileSizeBytes())
            .body(new ByteArrayResource(attachment.getFileData()));
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
