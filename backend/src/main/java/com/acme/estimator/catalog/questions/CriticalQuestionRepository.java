package com.acme.estimator.catalog.questions;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface CriticalQuestionRepository
    extends JpaRepository<CriticalQuestion, Long>, JpaSpecificationExecutor<CriticalQuestion> {

    List<CriticalQuestion> findByProductIdOrderByDisplayOrder(Long productId);

    List<CriticalQuestion> findBySubFeatureIdOrderByDisplayOrder(Long subFeatureId);

    long countByProductIdAndActiveTrue(Long productId);

    long countBySubFeatureIdAndActiveTrue(Long subFeatureId);

    @Query("select coalesce(max(q.displayOrder), 0) from CriticalQuestion q where q.productId = ?1")
    int findMaxDisplayOrderForProduct(Long productId);

    @Query("select coalesce(max(q.displayOrder), 0) from CriticalQuestion q where q.subFeatureId = ?1")
    int findMaxDisplayOrderForSubFeature(Long subFeatureId);

    /**
     * Used by the Change Log search predicate. Matches against the
     * question text itself (the closest thing to a "name" a question has).
     */
    @Query("select q.id from CriticalQuestion q where lower(q.questionText) like lower(concat('%', ?1, '%'))")
    List<Long> findIdsByQuestionTextContainingIgnoreCase(String search);
}
