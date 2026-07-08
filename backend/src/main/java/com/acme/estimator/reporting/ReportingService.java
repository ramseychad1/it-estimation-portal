package com.acme.estimator.reporting;

import com.acme.estimator.auth.User;
import com.acme.estimator.auth.UserRepository;
import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.products.dto.ProductListItem;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.estimates.Complexity;
import com.acme.estimator.estimates.EstimateRequestItem;
import com.acme.estimator.estimates.EstimateRequestItemRepository;
import com.acme.estimator.estimates.EstimateRequestPhaseLine;
import com.acme.estimator.estimates.EstimateRequestPhaseLineRepository;
import com.acme.estimator.estimates.EstimateStatus;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.rates.BlendedRateRepository;
import com.acme.estimator.teams.Team;
import com.acme.estimator.teams.TeamRepository;
import com.acme.estimator.teams.dto.TeamRef;
import com.acme.estimator.users.dto.UserListItem;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reporting service.
 *
 * <p>Rebuilt in UX-3 for the multi-product schema: workload counts and
 * approved hours/cost aggregate {@code estimate_request_items} (joined to
 * teams via each item's product), replacing the Phase 9a stub that returned
 * zeros. Approved hours come from each item's phase-line snapshot at its
 * approved complexity with reviewer overrides applied; cost uses the
 * blended rate snapshotted at approval, falling back to the current rate
 * for legacy items with no snapshot (same posture as carry-over #24).
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
    private final EstimateRequestItemRepository itemRepository;
    private final EstimateRequestPhaseLineRepository phaseLineRepository;
    private final BlendedRateRepository blendedRateRepository;

    // ---- summary -----------------------------------------------------------

    /**
     * Team workload summary. One row per team. Items on products with
     * team_id = NULL are excluded (they belong to no team's workload).
     */
    public List<TeamWorkloadRow> getTeamWorkloadSummary() {
        List<Team> teams = teamRepository.findAll(Sort.by("name").ascending());
        if (teams.isEmpty()) return List.of();

        List<Long> teamIds = teams.stream().map(Team::getId).toList();

        Map<Long, Long> memberCounts  = buildCountMap(teamRepository.countMembersByTeamIdIn(teamIds));
        Map<Long, Long> productCounts = buildCountMap(teamRepository.countActiveProductsByTeamIdIn(teamIds));

        // counts[0]=total non-draft, [1]=submitted, [2]=in review, [3]=approved
        Map<Long, long[]> itemCounts = new HashMap<>();
        for (Object[] row : itemRepository.countItemsByTeamAndStatus(teamIds)) {
            Long teamId = ((Number) row[0]).longValue();
            EstimateStatus status = (EstimateStatus) row[1];
            long count = ((Number) row[2]).longValue();
            long[] counts = itemCounts.computeIfAbsent(teamId, k -> new long[4]);
            counts[0] += count;
            switch (status) {
                case SUBMITTED -> counts[1] += count;
                case IN_REVIEW -> counts[2] += count;
                case APPROVED  -> counts[3] += count;
                default -> { /* rejected / clarification / recalled count toward total only */ }
            }
        }

        // metrics[0]=onshore hrs, [1]=offshore hrs, [2]=cost — approved items only
        Map<Long, BigDecimal[]> metrics = new HashMap<>();
        for (ApprovedItemTotals t : computeApprovedTotals(teamIds)) {
            BigDecimal[] m = metrics.computeIfAbsent(
                t.teamId, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            m[0] = m[0].add(t.onshoreHours);
            m[1] = m[1].add(t.offshoreHours);
            m[2] = m[2].add(t.cost);
        }

        return teams.stream().map(t -> {
            long[] counts = itemCounts.getOrDefault(t.getId(), new long[4]);
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

        // Recent approved items, newest decision first.
        List<RecentEstimateItem> recentEstimates = computeApprovedTotals(List.of(teamId)).stream()
            .sorted(Comparator.comparing(
                (ApprovedItemTotals t) -> t.reviewedAt,
                Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(10)
            .map(t -> new RecentEstimateItem(
                t.requestId, t.requestTitle, t.productName, t.complexity,
                t.onshoreHours, t.offshoreHours, t.cost, t.reviewedAt))
            .toList();

        return new TeamWorkloadDetail(teamId, team.getName(), members, products, recentEstimates);
    }

    // ---- approved-item math --------------------------------------------------

    private record ApprovedItemTotals(
        Long teamId,
        Long requestId,
        String requestTitle,
        String productName,
        Complexity complexity,
        BigDecimal onshoreHours,
        BigDecimal offshoreHours,
        BigDecimal cost,
        OffsetDateTime reviewedAt
    ) {}

    /**
     * Load every APPROVED item for the teams and total its snapshot hours
     * (overrides applied) + cost at the approved-rate snapshot.
     */
    private List<ApprovedItemTotals> computeApprovedTotals(List<Long> teamIds) {
        List<Object[]> rows = itemRepository.findApprovedItemsWithContextByTeamIds(teamIds);
        if (rows.isEmpty()) return List.of();

        List<Long> itemIds = rows.stream()
            .map(r -> ((EstimateRequestItem) r[0]).getId()).toList();
        Map<Long, List<EstimateRequestPhaseLine>> linesByItem = new HashMap<>();
        for (EstimateRequestPhaseLine line : phaseLineRepository.findByItemIdIn(itemIds)) {
            linesByItem.computeIfAbsent(line.getItemId(), k -> new ArrayList<>()).add(line);
        }

        List<Long> rateIds = rows.stream()
            .map(r -> ((EstimateRequestItem) r[0]).getApprovedBlendedRateId())
            .filter(java.util.Objects::nonNull)
            .distinct()
            .toList();
        Map<Long, BlendedRate> ratesById = new HashMap<>();
        blendedRateRepository.findAllById(rateIds).forEach(r -> ratesById.put(r.getId(), r));
        Optional<BlendedRate> currentRate = blendedRateRepository.findCurrentAsOf(LocalDate.now());

        List<ApprovedItemTotals> out = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            EstimateRequestItem item = (EstimateRequestItem) row[0];
            Long teamId = ((Number) row[1]).longValue();
            String productName = (String) row[2];
            String requestTitle = (String) row[3];

            BigDecimal ons = BigDecimal.ZERO;
            BigDecimal off = BigDecimal.ZERO;
            for (EstimateRequestPhaseLine line : linesByItem.getOrDefault(item.getId(), List.of())) {
                ons = ons.add(effectiveHours(line, item.getComplexity(), true));
                off = off.add(effectiveHours(line, item.getComplexity(), false));
            }

            BlendedRate rate = item.getApprovedBlendedRateId() != null
                ? ratesById.get(item.getApprovedBlendedRateId())
                : currentRate.orElse(null);
            BigDecimal cost = rate == null
                ? BigDecimal.ZERO
                : ons.multiply(rate.getOnshoreRate()).add(off.multiply(rate.getOffshoreRate()));

            out.add(new ApprovedItemTotals(
                teamId, item.getEstimateRequestId(), requestTitle, productName,
                item.getComplexity(), ons, off, cost, item.getReviewedAt()));
        }
        return out;
    }

    /** Override-aware hours for one snapshot line at the approved complexity. */
    private BigDecimal effectiveHours(
        EstimateRequestPhaseLine line, Complexity complexity, boolean onshore
    ) {
        BigDecimal override = onshore ? line.getOnshoreOverride() : line.getOffshoreOverride();
        if (override != null) return override;
        if (complexity == null) return BigDecimal.ZERO;
        BigDecimal value = switch (complexity) {
            case LOW  -> onshore ? line.getOnshoreLow()  : line.getOffshoreLow();
            case MED  -> onshore ? line.getOnshoreMed()  : line.getOffshoreMed();
            case HIGH -> onshore ? line.getOnshoreHigh() : line.getOffshoreHigh();
        };
        return value == null ? BigDecimal.ZERO : value;
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
