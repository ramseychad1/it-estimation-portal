package com.acme.estimator.phases;

import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.phases.dto.PhaseBenchmarksResponse;
import com.acme.estimator.phases.dto.PhaseBenchmarksUpdateRequest;
import com.acme.estimator.phases.dto.SdlcPhaseCreateRequest;
import com.acme.estimator.phases.dto.SdlcPhaseDto;
import com.acme.estimator.phases.dto.SdlcPhaseHistoryItem;
import com.acme.estimator.phases.dto.SdlcPhaseListItem;
import com.acme.estimator.phases.dto.SdlcPhaseReorderRequest;
import com.acme.estimator.phases.dto.SdlcPhaseUpdateRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/phases")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class SdlcPhaseController {

    private final SdlcPhaseService phaseService;
    private final PhaseBenchmarkService benchmarkService;
    private final UserRepository userRepository;

    // ---- Benchmark editor (declared before /{id} so the literal path wins) ----

    @GetMapping("/benchmarks")
    public PhaseBenchmarksResponse getBenchmarks() {
        return benchmarkService.get();
    }

    @PutMapping("/benchmarks")
    public PhaseBenchmarksResponse saveBenchmarks(
        @Valid @RequestBody PhaseBenchmarksUpdateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return benchmarkService.save(body, currentUser(principal));
    }

    @GetMapping
    public List<SdlcPhaseListItem> list(
        @RequestParam(required = false, defaultValue = "ALL") SdlcPhaseService.StatusFilter status
    ) {
        return phaseService.list(status).stream().map(SdlcPhaseListItem::from).toList();
    }

    @PostMapping
    public ResponseEntity<SdlcPhaseDto> create(
        @Valid @RequestBody SdlcPhaseCreateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        SdlcPhase created = phaseService.create(body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(SdlcPhaseDto.from(created));
    }

    @GetMapping("/{id}")
    public SdlcPhaseDto get(@PathVariable Long id) {
        return SdlcPhaseDto.from(phaseService.get(id));
    }

    @PatchMapping("/{id}")
    public SdlcPhaseDto update(
        @PathVariable Long id,
        @Valid @RequestBody SdlcPhaseUpdateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return SdlcPhaseDto.from(phaseService.update(id, body, currentUser(principal)));
    }

    @PostMapping("/{id}/activate")
    public SdlcPhaseDto activate(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        return SdlcPhaseDto.from(phaseService.activate(id, currentUser(principal)));
    }

    @PostMapping("/{id}/deactivate")
    public SdlcPhaseDto deactivate(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        return SdlcPhaseDto.from(phaseService.deactivate(id, currentUser(principal)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        phaseService.delete(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/reorder")
    public List<SdlcPhaseListItem> reorder(
        @Valid @RequestBody SdlcPhaseReorderRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return phaseService.reorder(body.phaseIds(), currentUser(principal))
            .stream().map(SdlcPhaseListItem::from).toList();
    }

    @GetMapping("/{id}/history")
    public List<SdlcPhaseHistoryItem> history(@PathVariable Long id) {
        return phaseService.history(id).stream().map(SdlcPhaseHistoryItem::from).toList();
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) {
            throw ApiException.forbidden("Authenticated user required");
        }
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
