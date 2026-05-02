package com.acme.estimator.audit.read;

import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.questions.CriticalQuestion;
import com.acme.estimator.catalog.questions.CriticalQuestionRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import com.acme.estimator.estimates.EstimateRequest;
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
    private final EstimateTemplateRepository templateRepository;

    private Map<String, Function<Long, String>> registry;

    private Map<String, Function<Long, String>> registry() {
        if (registry == null) {
            // Built lazily so injected repositories are present.
            registry = Map.ofEntries(
                Map.entry(Team.ENTITY_TYPE,             id -> "/admin/teams"),
                Map.entry(SdlcPhase.ENTITY_TYPE,        id -> "/admin/phases"),
                Map.entry(BlendedRate.ENTITY_TYPE,      id -> "/admin/rates"),
                Map.entry(UserService.ENTITY_TYPE,      id -> "/admin/users"),
                Map.entry(Product.ENTITY_TYPE,          id -> "/catalog/products/" + id),
                Map.entry(SubFeature.ENTITY_TYPE,       this::subFeatureHref),
                Map.entry(CriticalQuestion.ENTITY_TYPE, this::questionHref),
                Map.entry(EstimateTemplate.ENTITY_TYPE, this::templateHref),
                // Both Requester and (future) Reviewer surfaces will hang
                // off /requests/:id; the per-role view is decided by the
                // caller's auth, not by the URL.
                Map.entry(EstimateRequest.ENTITY_TYPE, id -> "/requests/" + id)
            );
        }
        return registry;
    }

    public String resolve(String entityType, Long entityId) {
        Function<Long, String> builder = registry().get(entityType);
        return builder == null ? null : builder.apply(entityId);
    }

    // The Function<Long, String> registry passes us raw {@code Long}s
    // from {@link #resolve}; the static type is nullable even though
    // {@code change_log.entity_id} is NOT NULL at the DB level. Each
    // helper guards on null up front so Spring Data's @NonNull-annotated
    // {@code findById} never sees a possibly-null value (and Eclipse's
    // null analysis stays quiet).

    private String subFeatureHref(Long subFeatureId) {
        // Sub-features live under their parent Product's URL. We need a
        // small lookup to fetch productId; this only fires when a
        // SubFeature row appears in the change log feed.
        if (subFeatureId == null) return null;
        return subFeatureRepository.findById(subFeatureId)
            .map(s -> "/catalog/products/" + s.getProductId() + "/sub-features/" + s.getId())
            .orElse(null);
    }

    private String templateHref(Long templateId) {
        // Templates live inline on their parent's detail page. Three-hop
        // for sub-feature templates: template → sub-feature → product.
        if (templateId == null) return null;
        return templateRepository.findById(templateId)
            .map(t -> {
                if (t.getProductId() != null) {
                    return "/catalog/products/" + t.getProductId();
                }
                Long subId = t.getSubFeatureId();
                if (subId != null) {
                    Long pid = subFeatureRepository.findById(subId)
                        .map(SubFeature::getProductId).orElse(null);
                    if (pid == null) return null;
                    return "/catalog/products/" + pid + "/sub-features/" + subId;
                }
                return null;
            })
            .orElse(null);
    }

    private String questionHref(Long questionId) {
        // Questions don't have detail pages — they live inside their
        // parent's detail page. Resolve to the parent's URL so the link
        // is meaningful even though the question itself isn't navigable.
        if (questionId == null) return null;
        return questionRepository.findById(questionId)
            .map(q -> {
                if (q.getProductId() != null) {
                    return "/catalog/products/" + q.getProductId();
                }
                Long subId = q.getSubFeatureId();
                if (subId != null) {
                    Long pid = subFeatureRepository.findById(subId)
                        .map(SubFeature::getProductId).orElse(null);
                    if (pid == null) return null;
                    return "/catalog/products/" + pid + "/sub-features/" + subId;
                }
                return null;
            })
            .orElse(null);
    }
}
