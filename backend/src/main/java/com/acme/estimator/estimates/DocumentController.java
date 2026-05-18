package com.acme.estimator.estimates;

import com.acme.estimator.auth.User;
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

    /**
     * Upload (or replace) the document for a specific question on a DRAFT item.
     * Requester must own the parent request.
     */
    @PostMapping("/estimates/items/{itemId}/answers/{questionId}/document")
    @PreAuthorize("hasAnyRole('REQUESTER','ADMIN')")
    public AttachmentMeta upload(
        @PathVariable Long itemId,
        @PathVariable Long questionId,
        @RequestParam("file") MultipartFile file,
        @AuthenticationPrincipal User actor
    ) {
        return documentService.upload(itemId, questionId, file, actor);
    }

    /**
     * Remove the document for a specific question on a DRAFT item.
     */
    @DeleteMapping("/estimates/items/{itemId}/answers/{questionId}/document")
    @PreAuthorize("hasAnyRole('REQUESTER','ADMIN')")
    public ResponseEntity<Void> delete(
        @PathVariable Long itemId,
        @PathVariable Long questionId,
        @AuthenticationPrincipal User actor
    ) {
        documentService.delete(itemId, questionId, actor);
        return ResponseEntity.noContent().build();
    }

    /**
     * Download an attachment. Streams the file as an attachment with the
     * original filename preserved. Accessible to the request owner, any SO,
     * and any Admin.
     */
    @GetMapping("/documents/{attachmentId}/download")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ByteArrayResource> download(
        @PathVariable Long attachmentId,
        @AuthenticationPrincipal User actor
    ) {
        AnswerAttachment attachment = documentService.download(attachmentId, actor);

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
}
