package com.acme.estimator.reporting;

import com.acme.estimator.catalog.products.dto.ProductListItem;
import com.acme.estimator.users.dto.UserListItem;
import java.util.List;

public record TeamWorkloadDetail(
    Long teamId,
    String teamName,
    List<UserListItem> members,
    List<ProductListItem> products,
    List<RecentEstimateItem> recentApprovedEstimates
) {}
