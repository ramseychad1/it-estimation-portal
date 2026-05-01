package com.acme.estimator.catalog.templates.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/**
 * Full-replacement save. Body must include exactly the set of phase ids
 * that the previous active version covered (active or inactive). The
 * server reconciles and rejects mismatches with VALIDATION_ERROR — see
 * {@link com.acme.estimator.catalog.templates.EstimateTemplateService#saveNewVersion}.
 */
public record SaveTemplateVersionRequest(
    @NotEmpty @Valid List<LineInput> lines,
    @Size(max = 4000) String changeReason
) {
    public record LineInput(
        @NotNull Long sdlcPhaseId,
        @NotNull @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal onshoreLow,
        @NotNull @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal onshoreMed,
        @NotNull @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal onshoreHigh,
        @NotNull @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal offshoreLow,
        @NotNull @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal offshoreMed,
        @NotNull @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal offshoreHigh
    ) {}
}
