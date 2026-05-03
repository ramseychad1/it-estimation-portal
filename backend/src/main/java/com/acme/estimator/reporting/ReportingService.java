package com.acme.estimator.reporting;

import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.products.dto.ProductListItem;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.EstimateRequest;
import com.acme.estimator.estimates.EstimateRequestPhaseLineRepository;
import com.acme.estimator.estimates.EstimateRequestPhaseLine;
import com.acme.estimator.estimates.EstimateRequestRepository;
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import com.acme.estimator.teams.dto.TeamRef;
import com.acme.estimator.users.dto.UserListItem;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
     */
    public List<TeamWorkloadRow> getTeamWorkloadSummary() {
        List<Team> teams = teamRepository.findAll(Sort.by("name").ascending());
        if (teams.isEmpty()) return List.of();

        List<Long> teamIds = teams.stream().map(Team::getId).toList();

        Map<Long, Long> memberCounts   = buildCountMap(teamRepository.countMembersByTeamIdIn(teamIds));
        Map<Long, Long> productCounts  = buildCountMap(teamRepository.countActiveProductsByTeamIdIn(teamIds));
        Map<Long, long[]> reqCounts    = buildRequestCountMap(
            estimateRequestRepository.countRequestsByTeamIdIn(teamIds));
        Map<Long, BigDecimal[]> metrics = computeApprovedMetrics(teamIds);

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

        // Members — JOIN FETCH u.teams already initialised
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

        // Recent approved estimates (last 10)
        List<Long> productIds = productEntities.stream().map(Product::getId).toList();
        List<RecentEstimateItem> recentEstimates = productIds.isEmpty()
            ? List.of()
            : buildRecentEstimates(productEntities, productIds);

        return new TeamWorkloadDetail(teamId, team.getName(), members, products, recentEstimates);
    }

    // ---- helpers -----------------------------------------------------------

    private List<RecentEstimateItem> buildRecentEstimates(
            List<Product> productEntities, List<Long> productIds) {
        List<EstimateRequest> approved = estimateRequestRepository.findRecentApprovedByProductIds(
            productIds, PageRequest.of(0, 10));
        if (approved.isEmpty()) return List.of();

        Map<Long, String> productNames = productEntities.stream()
            .collect(Collectors.toMap(Product::getId, Product::getName));

        List<Long> requestIds = approved.stream().map(EstimateRequest::getId).toList();
        List<EstimateRequestPhaseLine> allLines = phaseLineRepository.findByEstimateRequestIdIn(requestIds);
        Map<Long, List<EstimateRequestPhaseLine>> linesByRequest = allLines.stream()
            .collect(Collectors.groupingBy(EstimateRequestPhaseLine::getEstimateRequestId));

        List<RecentEstimateItem> items = new ArrayList<>();
        for (EstimateRequest er : approved) {
            List<EstimateRequestPhaseLine> lines =
                linesByRequest.getOrDefault(er.getId(), List.of());

            BigDecimal onshoreHours  = BigDecimal.ZERO;
            BigDecimal offshoreHours = BigDecimal.ZERO;
            for (EstimateRequestPhaseLine line : lines) {
                onshoreHours  = onshoreHours.add(
                    line.getOnshoreOverride()  != null ? line.getOnshoreOverride()  : line.getOnshoreMed());
                offshoreHours = offshoreHours.add(
                    line.getOffshoreOverride() != null ? line.getOffshoreOverride() : line.getOffshoreMed());
            }

            // Cost will be populated if blended rate snapshot exists on the request.
            // We don't have the rate entity here — compute via the summary helper path
            // or accept null cost for the detail view (consistent with EstimateDetailPage).
            // For detail view cost, use null (not an approved-blended-rate lookup here).
            items.add(new RecentEstimateItem(
                er.getId(),
                er.getTitle(),
                productNames.getOrDefault(er.getProductId(), ""),
                er.getComplexity(),
                onshoreHours,
                offshoreHours,
                null,
                er.getReviewedAt()
            ));
        }
        return items;
    }

    /** Converts List<Object[]> [id, count] rows to Map<id, count>. */
    private Map<Long, Long> buildCountMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return map;
    }

    /**
     * Converts countRequestsByTeamIdIn result rows to
     * Map&lt;teamId, [total, submitted, inReview, approved]&gt;.
     */
    private Map<Long, long[]> buildRequestCountMap(List<Object[]> rows) {
        Map<Long, long[]> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put(((Number) row[0]).longValue(), new long[]{
                ((Number) row[1]).longValue(),
                ((Number) row[2]).longValue(),
                ((Number) row[3]).longValue(),
                ((Number) row[4]).longValue()
            });
        }
        return map;
    }

    /**
     * Computes total approved onshore hours, offshore hours, and cost per team.
     * Cost uses the blended rate snapshot captured at approval time.
     * Returns Map&lt;teamId, [onshoreHours, offshoreHours, cost]&gt;.
     */
    private Map<Long, BigDecimal[]> computeApprovedMetrics(List<Long> teamIds) {
        List<Object[]> requestMeta = estimateRequestRepository.findApprovedWithRateByTeamIdIn(teamIds);
        if (requestMeta.isEmpty()) return Map.of();

        // Build lookup: requestId → [teamId, onshoreRate, offshoreRate]
        Map<Long, Object[]> metaByRequest = new LinkedHashMap<>();
        for (Object[] row : requestMeta) {
            metaByRequest.put(((Number) row[0]).longValue(), row);
        }

        List<EstimateRequestPhaseLine> allLines = phaseLineRepository.findByEstimateRequestIdIn(
            new ArrayList<>(metaByRequest.keySet()));

        Map<Long, List<EstimateRequestPhaseLine>> linesByRequest = allLines.stream()
            .collect(Collectors.groupingBy(EstimateRequestPhaseLine::getEstimateRequestId));

        Map<Long, BigDecimal[]> result = new HashMap<>();
        for (Map.Entry<Long, Object[]> entry : metaByRequest.entrySet()) {
            Long requestId = entry.getKey();
            Object[] meta  = entry.getValue();
            Long teamId    = ((Number) meta[1]).longValue();
            BigDecimal onshoreRate  = meta[3] != null ? (BigDecimal) meta[3] : null;
            BigDecimal offshoreRate = meta[4] != null ? (BigDecimal) meta[4] : null;

            BigDecimal[] teamMetrics = result.computeIfAbsent(teamId,
                k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});

            for (EstimateRequestPhaseLine line :
                    linesByRequest.getOrDefault(requestId, List.of())) {
                BigDecimal onHrs = line.getOnshoreOverride()  != null
                    ? line.getOnshoreOverride()  : line.getOnshoreMed();
                BigDecimal offHrs = line.getOffshoreOverride() != null
                    ? line.getOffshoreOverride() : line.getOffshoreMed();

                teamMetrics[0] = teamMetrics[0].add(onHrs);
                teamMetrics[1] = teamMetrics[1].add(offHrs);
                if (onshoreRate != null && offshoreRate != null) {
                    teamMetrics[2] = teamMetrics[2].add(
                        onHrs.multiply(onshoreRate).add(offHrs.multiply(offshoreRate)));
                }
            }
        }
        return result;
    }
}
