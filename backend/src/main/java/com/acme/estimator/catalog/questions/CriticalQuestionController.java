package com.acme.estimator.catalog.questions;

import com.acme.estimator.audit.ChangeLogEntry;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.questions.dto.CreateQuestionRequest;
import com.acme.estimator.catalog.questions.dto.ListQuestionsFilter;
import com.acme.estimator.catalog.questions.dto.QuestionDetail;
import com.acme.estimator.catalog.questions.dto.QuestionListItem;
import com.acme.estimator.catalog.questions.dto.ReorderQuestionsRequest;
import com.acme.estimator.catalog.questions.dto.UpdateQuestionRequest;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
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

/**
 * Three URL surfaces, all in this controller:
 *
 * <ul>
 *   <li>{@code /api/catalog/products/{productId}/questions} — in-context
 *       list / create / reorder for a product (atomic-only — server
 *       rejects on container products with active sub-features).</li>
 *   <li>{@code /api/catalog/sub-features/{subFeatureId}/questions} —
 *       same shape, scoped to a sub-feature.</li>
 *   <li>{@code /api/catalog/questions} — cross-catalog browser
 *       (paginated list with filters) and direct {@code /{id}} CRUD.</li>
 * </ul>
 */
@RestController
@PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REVENUE_MANAGER')")
@RequiredArgsConstructor
public class CriticalQuestionController {

    private final CriticalQuestionService questionService;
    private final UserRepository userRepository;

    // ---- in-context: under product -----------------------------------------

    @GetMapping("/api/catalog/products/{productId}/questions")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REQUESTER')")
    public List<QuestionListItem> listForProduct(@PathVariable Long productId) {
        return questionService.listByProduct(productId);
    }

    @PostMapping("/api/catalog/products/{productId}/questions")
    public ResponseEntity<QuestionDetail> createForProduct(
        @PathVariable Long productId,
        @Valid @RequestBody CreateQuestionRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        QuestionDetail created = questionService.createForProduct(productId, body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/api/catalog/products/{productId}/questions/reorder")
    public List<QuestionListItem> reorderForProduct(
        @PathVariable Long productId,
        @Valid @RequestBody ReorderQuestionsRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return questionService.reorderForProduct(productId, body.questionIds(), currentUser(principal));
    }

    // ---- in-context: under sub-feature ------------------------------------

    @GetMapping("/api/catalog/sub-features/{subFeatureId}/questions")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REQUESTER')")
    public List<QuestionListItem> listForSubFeature(@PathVariable Long subFeatureId) {
        return questionService.listBySubFeature(subFeatureId);
    }

    @PostMapping("/api/catalog/sub-features/{subFeatureId}/questions")
    public ResponseEntity<QuestionDetail> createForSubFeature(
        @PathVariable Long subFeatureId,
        @Valid @RequestBody CreateQuestionRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        QuestionDetail created = questionService.createForSubFeature(subFeatureId, body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/api/catalog/sub-features/{subFeatureId}/questions/reorder")
    public List<QuestionListItem> reorderForSubFeature(
        @PathVariable Long subFeatureId,
        @Valid @RequestBody ReorderQuestionsRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return questionService.reorderForSubFeature(subFeatureId, body.questionIds(), currentUser(principal));
    }

    // ---- cross-catalog browser + direct CRUD ------------------------------

    @GetMapping("/api/catalog/questions")
    public PageResponse<QuestionListItem> listAll(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String parentType,
        @RequestParam(required = false, defaultValue = "ALL") String required,
        @RequestParam(required = false, defaultValue = "ALL") String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @RequestParam(defaultValue = "questionText,asc") String sort
    ) {
        Boolean requiredOnly = parseTriState(required, "required");
        Boolean activeOnly = parseTriState(status, "status");

        if (parentType != null && !parentType.isBlank()
            && !"Product".equals(parentType) && !"SubFeature".equals(parentType)) {
            throw ApiException.badRequest("Invalid parentType: " + parentType);
        }

        ListQuestionsFilter filter = new ListQuestionsFilter(
            search,
            parentType == null || parentType.isBlank() ? null : parentType,
            requiredOnly,
            activeOnly
        );
        Page<QuestionListItem> result = questionService.listAll(
            filter, PageRequest.of(page, size, parseSort(sort))
        );
        return PageResponse.from(result, x -> x);
    }

    @GetMapping("/api/catalog/questions/{id}")
    public QuestionDetail get(@PathVariable Long id) {
        return questionService.get(id);
    }

    @PatchMapping("/api/catalog/questions/{id}")
    public QuestionDetail update(
        @PathVariable Long id,
        @Valid @RequestBody UpdateQuestionRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return questionService.update(id, body, currentUser(principal));
    }

    @PostMapping("/api/catalog/questions/{id}/activate")
    public QuestionDetail activate(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return questionService.activate(id, currentUser(principal));
    }

    @PostMapping("/api/catalog/questions/{id}/deactivate")
    public QuestionDetail deactivate(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        return questionService.deactivate(id, currentUser(principal));
    }

    @DeleteMapping("/api/catalog/questions/{id}")
    public ResponseEntity<Void> delete(
        @PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal
    ) {
        questionService.delete(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/catalog/questions/{id}/history")
    public List<ChangeLogEntry> history(@PathVariable Long id) {
        return questionService.history(id);
    }

    // ---- helpers ----------------------------------------------------------

    private User currentUser(AppUserDetails principal) {
        if (principal == null) throw ApiException.forbidden("Authenticated user required");
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }

    private Sort parseSort(String raw) {
        if (raw == null || raw.isBlank()) return Sort.by("questionText").ascending();
        String[] parts = raw.split(",", 2);
        String prop = parts[0].trim();
        Sort.Direction dir = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())
            ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(dir, prop);
    }

    /**
     * Parses "ALL" / "REQUIRED" / "OPTIONAL" / "ACTIVE" / "INACTIVE" into
     * {@code null} / {@code Boolean.TRUE} / {@code Boolean.FALSE}. The
     * "required" filter and "status" filter share this mapping (TRUE means
     * "the positive case").
     */
    private static Boolean parseTriState(String raw, String paramName) {
        if (raw == null) return null;
        return switch (raw.toUpperCase()) {
            case "ALL" -> null;
            case "REQUIRED", "ACTIVE" -> Boolean.TRUE;
            case "OPTIONAL", "INACTIVE" -> Boolean.FALSE;
            default -> throw ApiException.badRequest("Invalid " + paramName + " filter: " + raw);
        };
    }
}
