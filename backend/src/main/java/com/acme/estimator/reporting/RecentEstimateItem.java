package com.acme.estimator.reporting;

import com.acme.estimator.estimates.Complexity;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RecentEstimateItem(
    Long id,
    String title,
    String productName,
    Complexity complexity,
    BigDecimal totalOnshoreHours,
    BigDecimal totalOffshoreHours,
    BigDecimal cost,
    OffsetDateTime reviewedAt
) {}
