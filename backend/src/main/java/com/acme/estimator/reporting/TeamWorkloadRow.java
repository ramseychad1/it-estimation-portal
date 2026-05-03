package com.acme.estimator.reporting;

import java.math.BigDecimal;

public record TeamWorkloadRow(
    Long teamId,
    String teamName,
    long memberCount,
    long activeProductCount,
    long totalEstimateRequests,
    long submittedCount,
    long inReviewCount,
    long approvedCount,
    BigDecimal totalApprovedOnshoreHours,
    BigDecimal totalApprovedOffshoreHours,
    BigDecimal totalApprovedCost
) {}
