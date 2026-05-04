package com.acme.estimator.reporting;

import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.products.dto.ProductListItem;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.EstimateRequestPhaseLineRepository;
import com.acme.estimator.estimates.EstimateRequestRepository;
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import com.acme.estimator.teams.dto.TeamRef;
import com.acme.estimator.users.dto.UserListItem;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reporting service.
 *
 * <p>TODO Phase 9a: reporting queries need rewrite for multi-product schema.
 * The team workload stats (countRequestsByTeamIdIn, findApprovedWithRateByTeamIdIn,
 * findRecentApprovedByProductIds) relied on columns that were moved to
 * estimate_request_items. The summary stats return zeros and the recent-estimates
 * list is empty until the queries are rebuilt against the new schema.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportingService {

    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;
    private final CriticalQuestionRepository questionRepository;
    private final EstimateRequestRepository estimateRequestRepository;
    private final EstimateRequestPhaseLineRepository phaseLineRepository;

    // ---- summary -----------------------------------------------------------

    /**
     * Team workload summary. One row per team.
     * Products with team_id = NULL are excluded from request counts.
     *
     * <p>TODO Phase 9a: request count columns (totalRequests, submitted, inReview, approved)
     * return zeros until countRequestsByTeamIdIn is rebuilt for the multi-product schema.
     */
    public List<TeamWorkloadRow> getTeamWorkloadSummary() {
        List<Team> teams = teamRepository.findAll(Sort.by("name").ascending());
        if (teams.isEmpty()) return List.of();

        List<Long> teamIds = teams.stream().map(Team::getId).toList();

        Map<Long, Long> memberCounts   = buildCountMap(teamRepository.countMembersByTeamIdIn(teamIds));
        Map<Long, Long> productCounts  = buildCountMap(teamRepository.countActiveProductsByTeamIdIn(teamIds));

        // TODO Phase 9a: reporting queries need rewrite for multi-product schema.
        // Stub: all request counts are zero until rebuilt.
        Map<Long, long[]> reqCounts = new HashMap<>();
        Map<Long, BigDecimal[]> metrics = new HashMap<>();

        return teams.stream().map(t -> {
            long[] counts = reqCounts.getOrDefault(t.getId(), new long[4]);
            BigDecimal[] m = metrics.getOrDefault(t.getId(),
                new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            return new TeamWorkloadRow(
                t.getId(),
                t.getName(),
                memberCounts.getOrDefault(t.getId(), 0L),
                productCounts.getOrDefault(t.getId(), 0L),
                counts[0], counts[1], counts[2], counts[3],
                m[0], m[1], m[2]
            );
        }).toList();
    }

    // ---- detail ------------------------------------------------------------

    public TeamWorkloadDetail getTeamWorkloadDetail(Long teamId) {
        Team team = teamRepository.findById(teamId)
            .orElseThrow(() -> ApiException.notFound("Team " + teamId + " not found"));

        // Members
        List<User> memberUsers = userRepository.findByTeamId(teamId);
        List<UserListItem> members = memberUsers.stream()
            .map(u -> {
                List<TeamRef> userTeams = u.getTeams().stream()
                    .sorted(Comparator.comparing(Team::getName))
                    .map(TeamRef::from)
                    .toList();
                return UserListItem.from(u, userTeams);
            })
            .toList();

        // Products
        List<Product> productEntities = productRepository.findActiveByTeamId(teamId);
        List<ProductListItem> products = productEntities.stream()
            .map(p -> {
                int subCount = (int) subFeatureRepository.countByProductIdAndActiveTrue(p.getId());
                int qCount   = (int) questionRepository.countByProductIdAndActiveTrue(p.getId());
                return ProductListItem.from(p, subCount, qCount);
            })
            .toList();

        // TODO Phase 9a: reporting queries need rewrite for multi-product schema.
        // Recent approved estimates return empty list until rebuilt.
        List<RecentEstimateItem> recentEstimates = List.of();

        return new TeamWorkloadDetail(teamId, team.getName(), members, products, recentEstimates);
    }

    // ---- helpers -----------------------------------------------------------

    /** Converts List<Object[]> [id, count] rows to Map<id, count>. */
    private Map<Long, Long> buildCountMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return map;
    }
}
