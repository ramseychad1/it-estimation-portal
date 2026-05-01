package com.acme.estimator.catalog.subfeatures;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface SubFeatureRepository
    extends JpaRepository<SubFeature, Long>, JpaSpecificationExecutor<SubFeature> {

    Optional<SubFeature> findByProductIdAndNameIgnoreCaseAndActiveTrue(Long productId, String name);

    List<SubFeature> findByProductIdOrderByName(Long productId);

    long countByProductIdAndActiveTrue(Long productId);

    /** Used by the Change Log search predicate. */
    @Query("select s.id from SubFeature s where lower(s.name) like lower(concat('%', ?1, '%'))")
    List<Long> findIdsByNameContainingIgnoreCase(String search);
}
