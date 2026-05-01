package com.acme.estimator.audit.read;

import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.phases.SdlcPhase;
import com.acme.estimator.rates.BlendedRate;
import com.acme.estimator.teams.Team;
import com.acme.estimator.users.UserService;
import java.util.Map;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps an audit row's {@code (entity_type, entity_id)} to the frontend
 * route the "View entity →" link should jump to.
 *
 * Most types are static (e.g. Team → {@code /admin/teams}); SubFeature
 * and CriticalQuestion need a per-id lookup because the route depends on
 * the parent. Returns {@code null} when the entity has been deleted or
 * the type is unknown — the controller passes that straight through and
 * the UI hides the link.
 *
 * The signature takes both type and id so the per-type lookup stays
 * encapsulated here; {@link ChangeLogReadService} already knows the
 * entity is "live" (not deleted) before calling, so we don't need to
 * re-check existence on every resolution.
 */
@Component
@RequiredArgsConstructor
public class EntityHrefResolver {

    private final SubFeatureRepository subFeatureRepository;
    private final CriticalQuestionRepository questionRepository;

    private Map<String, Function<Long, String>> registry;

    private Map<String, Function<Long, String>> registry() {
        if (registry == null) {
            // Built lazily so injected repositories are present.
            registry = Map.of(
                Team.ENTITY_TYPE,             id -> "/admin/teams",
                SdlcPhase.ENTITY_TYPE,        id -> "/admin/phases",
                BlendedRate.ENTITY_TYPE,      id -> "/admin/rates",
                UserService.ENTITY_TYPE,      id -> "/admin/users",
                Product.ENTITY_TYPE,          id -> "/catalog/products/" + id,
                SubFeature.ENTITY_TYPE,       this::subFeatureHref,
                CriticalQuestion.ENTITY_TYPE, this::questionHref
            );
        }
        return registry;
    }

    public String resolve(String entityType, Long entityId) {
        Function<Long, String> builder = registry().get(entityType);
        return builder == null ? null : builder.apply(entityId);
    }

    private String subFeatureHref(Long subFeatureId) {
        // Sub-features live under their parent Product's URL. We need a
        // small lookup to fetch productId; this only fires when a
        // SubFeature row appears in the change log feed.
        return subFeatureRepository.findById(subFeatureId)
            .map(s -> "/catalog/products/" + s.getProductId() + "/sub-features/" + s.getId())
            .orElse(null);
    }

    private String questionHref(Long questionId) {
        // Questions don't have detail pages — they live inside their
        // parent's detail page. Resolve to the parent's URL so the link
        // is meaningful even though the question itself isn't navigable.
        return questionRepository.findById(questionId)
            .map(q -> {
                if (q.getProductId() != null) {
                    return "/catalog/products/" + q.getProductId();
                }
                if (q.getSubFeatureId() != null) {
                    Long pid = subFeatureRepository.findById(q.getSubFeatureId())
                        .map(SubFeature::getProductId).orElse(null);
                    if (pid == null) return null;
                    return "/catalog/products/" + pid + "/sub-features/" + q.getSubFeatureId();
                }
                return null;
            })
            .orElse(null);
    }
}
