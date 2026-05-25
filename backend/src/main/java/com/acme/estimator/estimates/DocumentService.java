package com.acme.estimator.estimates;

import com.acme.estimator.auth.User;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.dto.AttachmentMeta;
import java.io.IOException;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final long MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    private static final Set<String> ALLOWED_TYPES = Set.of(
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    private final AnswerAttachmentRepository attachmentRepository;
    private final EstimateRequestItemRepository itemRepository;
    private final EstimateRequestRepository requestRepository;

    /**
     * Upload a new attachment for a specific item + question.
     * Multiple files per question are allowed. Only the request owner may
     * upload, and only while the item is in DRAFT.
     */
    @Transactional
    public AttachmentMeta upload(Long itemId, Long questionId, MultipartFile file, User actor) {
        EstimateRequestItem item = loadItem(itemId);
        assertOwnerAndDraft(item, actor);
        validateFile(file);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read uploaded file.");
        }

        AnswerAttachment attachment = new AnswerAttachment();
        attachment.setItemId(itemId);
        attachment.setQuestionId(questionId);
        attachment.setOriginalFilename(file.getOriginalFilename() != null
            ? file.getOriginalFilename() : "upload");
        attachment.setContentType(file.getContentType());
        attachment.setFileSizeBytes(bytes.length);
        attachment.setFileData(bytes);
        attachment.setUploadedBy(actor.getId());

        AnswerAttachment saved = attachmentRepository.save(attachment);
        return toMeta(saved);
    }

    /**
     * Remove a specific attachment by its ID. Only the request owner may
     * delete, and only while the item is in DRAFT.
     */
    @Transactional
    public void delete(Long attachmentId, User actor) {
        AnswerAttachment attachment = attachmentRepository.findById(attachmentId)
            .orElseThrow(() -> ApiException.notFound("Attachment " + attachmentId + " not found."));
        EstimateRequestItem item = loadItem(attachment.getItemId());
        assertOwnerAndDraft(item, actor);
        attachmentRepository.deleteById(attachmentId);
    }

    /**
     * Returns the full attachment for streaming. Accessible to: the request
     * owner, any Solution Owner, and any Admin.
     */
    @Transactional(readOnly = true)
    public AnswerAttachment download(Long attachmentId, User actor) {
        AnswerAttachment attachment = attachmentRepository.findById(attachmentId)
            .orElseThrow(() -> ApiException.notFound("Attachment " + attachmentId + " not found."));

        EstimateRequestItem item = loadItem(attachment.getItemId());
        EstimateRequest request = requestRepository.findById(item.getEstimateRequestId())
            .orElseThrow(() -> ApiException.notFound("Attachment " + attachmentId + " not found."));

        boolean isOwner = request.getRequesterId().equals(actor.getId());
        boolean canReview = actor.isAdmin()
            || actor.getRoles().stream().anyMatch(r -> r.getName().equals("Solution Owner"));

        if (!isOwner && !canReview) {
            throw ApiException.notFound("Attachment " + attachmentId + " not found.");
        }

        return attachment;
    }

    // -------------------------------------------------------------------------

    private EstimateRequestItem loadItem(Long itemId) {
        return itemRepository.findById(itemId)
            .orElseThrow(() -> ApiException.notFound("Estimate item " + itemId + " not found."));
    }

    private void assertOwnerAndDraft(EstimateRequestItem item, User actor) {
        EstimateRequest request = requestRepository.findById(item.getEstimateRequestId())
            .orElseThrow(() -> ApiException.notFound("Estimate request not found."));
        if (!request.getRequesterId().equals(actor.getId()) && !actor.isAdmin()) {
            throw ApiException.notFound("Estimate item " + item.getId() + " not found.");
        }
        if (item.getStatus() != EstimateStatus.DRAFT) {
            throw ApiException.badRequest("Documents can only be changed while the item is in DRAFT.");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw ApiException.badRequest("Uploaded file is empty.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("File exceeds the 10 MB limit.");
        }
        String ct = file.getContentType();
        if (ct == null || !ALLOWED_TYPES.contains(ct)) {
            throw ApiException.badRequest(
                "Unsupported file type. Allowed: PDF, Word (DOCX/DOC), Excel (XLSX/XLS).");
        }
    }

    private AttachmentMeta toMeta(AnswerAttachment a) {
        return new AttachmentMeta(
            a.getId(), a.getItemId(), a.getQuestionId(),
            a.getOriginalFilename(), a.getContentType(),
            a.getFileSizeBytes(), a.getUploadedAt()
        );
    }
}
