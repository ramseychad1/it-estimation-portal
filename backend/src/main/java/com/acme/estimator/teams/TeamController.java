package com.acme.estimator.teams;

import com.acme.estimator.common.PageLimits;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import com.acme.estimator.teams.dto.BulkIdsRequest;
import com.acme.estimator.teams.dto.BulkResult;
import com.acme.estimator.teams.dto.TeamCreateRequest;
import com.acme.estimator.teams.dto.TeamDto;
import com.acme.estimator.teams.dto.TeamHistoryItem;
import com.acme.estimator.teams.dto.TeamListItem;
import com.acme.estimator.teams.dto.TeamUpdateRequest;
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
@RequestMapping("/api/admin/teams")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;
    private final UserRepository userRepository;

    @GetMapping
    public PageResponse<TeamListItem> list(
        @RequestParam(required = false) String search,
        @RequestParam(required = false, defaultValue = "ALL") TeamService.StatusFilter status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @RequestParam(defaultValue = "name,asc") String sort
    ) {
        Sort sortSpec = parseSort(sort);
        Page<TeamListItem> result = teamService.list(search, status, PageLimits.of(page, size, sortSpec));
        return PageResponse.from(result, t -> t);
    }

    @PostMapping
    public ResponseEntity<TeamDto> create(
        @Valid @RequestBody TeamCreateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        Team created = teamService.create(body, currentUser(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(TeamDto.from(created));
    }

    @GetMapping("/{id}")
    public TeamDto get(@PathVariable Long id) {
        return TeamDto.from(teamService.get(id));
    }

    @PatchMapping("/{id}")
    public TeamDto update(
        @PathVariable Long id,
        @Valid @RequestBody TeamUpdateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return TeamDto.from(teamService.update(id, body, currentUser(principal)));
    }

    @PostMapping("/{id}/activate")
    public TeamDto activate(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        return TeamDto.from(teamService.activate(id, currentUser(principal)));
    }

    @PostMapping("/{id}/deactivate")
    public TeamDto deactivate(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        return TeamDto.from(teamService.deactivate(id, currentUser(principal)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal AppUserDetails principal) {
        teamService.delete(id, currentUser(principal));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk/activate")
    public BulkResult bulkActivate(
        @Valid @RequestBody BulkIdsRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return teamService.bulkActivate(body.ids(), currentUser(principal));
    }

    @PostMapping("/bulk/deactivate")
    public BulkResult bulkDeactivate(
        @Valid @RequestBody BulkIdsRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return teamService.bulkDeactivate(body.ids(), currentUser(principal));
    }

    @DeleteMapping("/bulk")
    public BulkResult bulkDelete(
        @Valid @RequestBody BulkIdsRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return teamService.bulkDelete(body.ids(), currentUser(principal));
    }

    @GetMapping("/{id}/history")
    public List<TeamHistoryItem> history(@PathVariable Long id) {
        return teamService.history(id).stream().map(TeamHistoryItem::from).toList();
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> export(
        @RequestParam(required = false) String search,
        @RequestParam(required = false, defaultValue = "ALL") TeamService.StatusFilter status
    ) {
        TeamService.TeamExport bundle = teamService.listForExport(search, status);
        String filename = "teams_export_" + LocalDate.now() + ".csv";
        StreamingResponseBody stream = out -> {
            try {
                TeamCsvWriter.write(out, bundle.teams(), bundle.userNames());
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
        if (principal == null) {
            throw ApiException.forbidden("Authenticated user required");
        }
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
