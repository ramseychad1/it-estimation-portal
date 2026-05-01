package com.acme.estimator.catalog.templates;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EstimateTemplateRepository extends JpaRepository<EstimateTemplate, Long> {

    @Query("select t from EstimateTemplate t where t.productId = ?1 and t.active = true")
    Optional<EstimateTemplate> findActiveByProductId(Long productId);

    @Query("select t from EstimateTemplate t where t.subFeatureId = ?1 and t.active = true")
    Optional<EstimateTemplate> findActiveBySubFeatureId(Long subFeatureId);

    /** Used for change-log lookups; never surfaced in the UI (no version picker). */
    List<EstimateTemplate> findAllByProductIdOrderByVersionNumberDesc(Long productId);

    List<EstimateTemplate> findAllBySubFeatureIdOrderByVersionNumberDesc(Long subFeatureId);

    /** Used by the SDLC phase activation guard. */
    long countByActiveTrue();

    @Query("select coalesce(max(t.versionNumber), 0) from EstimateTemplate t where t.productId = ?1")
    int maxVersionNumberForProduct(Long productId);

    @Query("select coalesce(max(t.versionNumber), 0) from EstimateTemplate t where t.subFeatureId = ?1")
    int maxVersionNumberForSubFeature(Long subFeatureId);
}
