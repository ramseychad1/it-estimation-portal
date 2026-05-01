package com.acme.estimator.audit.read;

import com.acme.estimator.catalog.products.ProductRepository;
import com.acme.estimator.catalog.subfeatures.SubFeature;
import com.acme.estimator.catalog.subfeatures.SubFeatureRepository;
import com.acme.estimator.catalog.templates.EstimateTemplate;
import com.acme.estimator.catalog.templates.EstimateTemplateRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Templates have no "name" column — their human-readable label is
 * derived: "Estimate template for {Parent} — v{N}". The parent name
 * lookup is two-hop for sub-feature templates: template → sub-feature →
 * product (for "Estimate template for iOS — v3").
 *
 * <p>{@link #findIdsMatchingName} returns empty: searching by template
 * name from the change-log search box isn't a real use case. Users find
 * template rows via the Action filter (CREATED), the Actor filter, or
 * by searching the parent product/sub-feature name (which surfaces the
 * parent's audit rows).
 */
@Component
@RequiredArgsConstructor
class EstimateTemplateNameResolver implements EntityNameResolver {

    static final String DELETED = "Deleted template";

    private final EstimateTemplateRepository templateRepository;
    private final ProductRepository productRepository;
    private final SubFeatureRepository subFeatureRepository;

    @Override
    public String entityType() {
        return EstimateTemplate.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);

        // Pull the templates in one batch; collect the parent ids by side.
        Set<Long> productIds = new HashSet<>();
        Set<Long> subFeatureIds = new HashSet<>();
        Map<Long, EstimateTemplate> templates = new HashMap<>();
        templateRepository.findAllById(ids).forEach(t -> {
            templates.put(t.getId(), t);
            if (t.getProductId() != null) productIds.add(t.getProductId());
            if (t.getSubFeatureId() != null) subFeatureIds.add(t.getSubFeatureId());
        });

        // Two batched lookups for the parent rows.
        Map<Long, String> productNames = new HashMap<>();
        productRepository.findAllById(productIds).forEach(p -> productNames.put(p.getId(), p.getName()));
        Map<Long, SubFeature> subFeaturesById = new HashMap<>();
        subFeatureRepository.findAllById(subFeatureIds).forEach(s -> subFeaturesById.put(s.getId(), s));

        // For sub-features, we need the grandparent product's name too.
        Set<Long> grandparentIds = new HashSet<>();
        subFeaturesById.values().forEach(s -> grandparentIds.add(s.getProductId()));
        Map<Long, String> grandparentNames = new HashMap<>();
        productRepository.findAllById(grandparentIds)
            .forEach(p -> grandparentNames.put(p.getId(), p.getName()));

        for (EstimateTemplate t : templates.values()) {
            String parentLabel;
            if (t.getProductId() != null) {
                parentLabel = productNames.getOrDefault(t.getProductId(), "Deleted product");
            } else if (t.getSubFeatureId() != null) {
                SubFeature sub = subFeaturesById.get(t.getSubFeatureId());
                if (sub == null) {
                    parentLabel = "Deleted sub-feature";
                } else {
                    String gp = grandparentNames.getOrDefault(sub.getProductId(), "Deleted product");
                    parentLabel = sub.getName() + " on " + gp;
                }
            } else {
                parentLabel = "(orphaned)";
            }
            out.put(t.getId(),
                "Estimate template for " + parentLabel + " — v" + t.getVersionNumber());
        }
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        // Template names are derived; not a useful search target. Users
        // filter by Action / Actor / Date or search the parent's name.
        return Set.of();
    }
}
