package com.acme.estimator.rates;

import com.acme.estimator.common.PageLimits;
import com.acme.estimator.auth.AppUserDetails;
import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.common.PageResponse;
import com.acme.estimator.rates.dto.BlendedRateDto;
import com.acme.estimator.rates.dto.BlendedRateListItem;
import com.acme.estimator.rates.dto.CreateRateRequest;
import com.acme.estimator.rates.dto.RatesPageResponse;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Blended rates API.
 *
 * INTENTIONAL: there is no PATCH or DELETE route. Rate rows are immutable;
 * Spring will return 405 Method Not Allowed for those verbs, which is the
 * audit-friendly behaviour we want. Tests assert this explicitly.
 */
@RestController
@RequestMapping("/api/admin/rates")
// Class-level gate: ADMIN for mutations. GET methods open the gate to
// SOLUTION_OWNER too via per-method @PreAuthorize so the Phase 6b
// review screen can show the cost preview without inventing a new
// rates endpoint.
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class BlendedRateController {

    private final BlendedRateService rateService;
    private final UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REQUESTER')")
    public RatesPageResponse listCurrentAndHistory(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        LocalDate today = LocalDate.now();
        Optional<BlendedRate> current = rateService.getCurrentRate();
        Long currentId = current.map(BlendedRate::getId).orElse(null);

        Page<BlendedRate> historyPage = rateService.getHistory(PageLimits.of(page, size));
        PageResponse<BlendedRateListItem> history = PageResponse.from(historyPage,
            r -> BlendedRateListItem.from(
                r,
                r.getId().equals(currentId),
                r.getEffectiveDate().isAfter(today)
            )
        );

        BlendedRateDto currentDto = current
            .map(r -> BlendedRateDto.from(r, true, false))
            .orElse(null);

        return new RatesPageResponse(currentDto, history);
    }

    @PostMapping
    public ResponseEntity<BlendedRateDto> create(
        @Valid @RequestBody CreateRateRequest body,
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        BlendedRate created = rateService.createRate(body, currentUser(principal));
        LocalDate today = LocalDate.now();
        // Recompute current/scheduled flags on the freshly-saved row so the
        // response carries the right pills for the client.
        boolean scheduled = created.getEffectiveDate().isAfter(today);
        boolean current = !scheduled && rateService.getCurrentRate()
            .map(r -> r.getId().equals(created.getId()))
            .orElse(false);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(BlendedRateDto.from(created, current, scheduled));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER','REQUESTER')")
    public BlendedRateDto get(@PathVariable Long id) {
        BlendedRate rate = rateService.getById(id);
        LocalDate today = LocalDate.now();
        boolean scheduled = rate.getEffectiveDate().isAfter(today);
        boolean current = !scheduled && rateService.getCurrentRate()
            .map(r -> r.getId().equals(rate.getId()))
            .orElse(false);
        return BlendedRateDto.from(rate, current, scheduled);
    }

    private User currentUser(AppUserDetails principal) {
        if (principal == null) {
            throw ApiException.forbidden("Authenticated user required");
        }
        return userRepository.findById(principal.getUserId())
            .orElseThrow(() -> ApiException.forbidden("Authenticated user not found"));
    }
}
