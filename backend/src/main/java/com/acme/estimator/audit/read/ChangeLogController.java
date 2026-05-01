package com.acme.estimator.audit.read;

import com.acme.estimator.audit.ChangeAction;
import com.acme.estimator.audit.read.dto.ChangeLogFilterOptions;
import com.acme.estimator.audit.read.dto.ChangeLogFilters;
import com.acme.estimator.audit.read.dto.ChangeLogPageResponse;
import com.acme.estimator.common.ApiException;
import java.io.IOException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * Read-only audit feed.
 *
 * Three endpoints:
 *   GET /              — paged, filtered, grouped feed
 *   GET /filters       — universe of filter options for the dropdowns
 *   GET /export        — CSV (raw rows, not groups)
 *
 * No POST/PATCH/DELETE — the audit log is intentionally read-only at
 * this layer, and audit-write paths live in the producing services
 * (TeamService, SdlcPhaseService, etc.).
 */
@RestController
@RequestMapping("/api/admin/change-log")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class ChangeLogController {

    /** Default range when neither {@code from} nor {@code to} is supplied. */
    private static final int DEFAULT_RANGE_DAYS = 30;

    /** Hard cap on page size; defends against absurd query strings. */
    private static final int MAX_PAGE_SIZE = 100;

    private final ChangeLogReadService readService;

    @GetMapping
    public ChangeLogPageResponse list(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String entityTypes,
        @RequestParam(required = false) String actions,
        @RequestParam(required = false) String actorIds,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size,
        @RequestParam(defaultValue = "desc") String sortDir
    ) {
        ChangeLogFilters filters = parseFilters(search, entityTypes, actions, actorIds, from, to, sortDir);
        if (size < 1) {
            throw ApiException.badRequest("Page size must be >= 1, got " + size);
        }
        if (size > MAX_PAGE_SIZE) {
            // Reject loudly instead of silently clamping — a caller asking for
            // size=10000 has built the wrong assumption into their integration
            // and should hear it from the API, not from an unexpected page count.
            throw ApiException.badRequest(
                "Page size must be <= " + MAX_PAGE_SIZE + ", got " + size
            );
        }
        int boundedPage = Math.max(0, page);
        return readService.list(filters, boundedPage, size);
    }

    @GetMapping("/filters")
    public ChangeLogFilterOptions filters() {
        return readService.filterOptions();
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<StreamingResponseBody> export(
        @RequestParam(required = false, defaultValue = "csv") String format,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String entityTypes,
        @RequestParam(required = false) String actions,
        @RequestParam(required = false) String actorIds,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to,
        @RequestParam(defaultValue = "desc") String sortDir
    ) {
        if (!"csv".equalsIgnoreCase(format)) {
            throw ApiException.badRequest("Unsupported export format: " + format);
        }
        ChangeLogFilters filters = parseFilters(search, entityTypes, actions, actorIds, from, to, sortDir);
        ChangeLogReadService.ExportBundle bundle = readService.exportBundle(filters);

        String filename = "change_log_export_" + LocalDate.now() + ".csv";
        StreamingResponseBody stream = out -> {
            try {
                ChangeLogCsvWriter.write(out, bundle.rows(), bundle.actorNames(), bundle.entityNamesByType());
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

    private ChangeLogFilters parseFilters(
        String search,
        String entityTypes,
        String actions,
        String actorIds,
        String from,
        String to,
        String sortDir
    ) {
        Set<String> entityTypeSet = parseStringSet(entityTypes);
        Set<ChangeAction> actionSet = parseEnumSet(actions);
        Set<Long> actorIdSet = parseLongSet(actorIds);
        OffsetDateTime fromDt = parseInstant(from, /*startOfDay=*/true);
        OffsetDateTime toDt = parseInstant(to, /*startOfDay=*/false);

        // Default to "last 30 days" only if BOTH endpoints are missing — a
        // user passing just `from` or just `to` clearly means open-ended.
        if (fromDt == null && toDt == null) {
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
            fromDt = now.minusDays(DEFAULT_RANGE_DAYS);
            toDt = now;
        }

        boolean ascending = "asc".equalsIgnoreCase(sortDir);
        return new ChangeLogFilters(search, entityTypeSet, actionSet, actorIdSet, fromDt, toDt, ascending);
    }

    private static Set<String> parseStringSet(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        return Arrays.stream(csv.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toCollection(HashSet::new));
    }

    private static Set<Long> parseLongSet(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        try {
            return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::valueOf)
                .collect(Collectors.toCollection(HashSet::new));
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Invalid actor id list: " + csv);
        }
    }

    private static Set<ChangeAction> parseEnumSet(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        try {
            return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> ChangeAction.valueOf(s.toUpperCase()))
                .collect(Collectors.toCollection(HashSet::new));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid action filter: " + csv);
        }
    }

    /**
     * Accepts ISO-8601 dates (yyyy-MM-dd) and full ISO-8601 instants. A
     * bare date is normalised to start-of-day UTC for {@code from} and
     * end-of-day UTC for {@code to} — the user's mental model is "give me
     * everything on this day," not "midnight at the boundary."
     */
    private static OffsetDateTime parseInstant(String raw, boolean startOfDay) {
        if (raw == null || raw.isBlank()) return null;
        try {
            if (raw.length() == 10) {
                LocalDate date = LocalDate.parse(raw);
                return startOfDay
                    ? date.atStartOfDay(ZoneOffset.UTC).toOffsetDateTime()
                    : date.atTime(23, 59, 59, 999_000_000).atOffset(ZoneOffset.UTC);
            }
            return OffsetDateTime.parse(raw);
        } catch (Exception e) {
            throw ApiException.badRequest("Invalid date: " + raw);
        }
    }
}
