package com.acme.estimator.rates.dto;

import com.acme.estimator.common.PageResponse;

/**
 * Single payload returned by GET /api/admin/rates — the page only ever
 * shows current + history together, so we round-trip both here.
 *
 * {@code current} is null on Day 1 (no rate has yet taken effect).
 */
public record RatesPageResponse(
    BlendedRateDto current,
    PageResponse<BlendedRateListItem> history
) {}
