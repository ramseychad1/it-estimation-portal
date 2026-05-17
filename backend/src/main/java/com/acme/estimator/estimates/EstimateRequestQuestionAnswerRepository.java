package com.acme.estimator.estimates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface EstimateRequestQuestionAnswerRepository
    extends JpaRepository<EstimateRequestQuestionAnswer, Long> {

    List<EstimateRequestQuestionAnswer> findAllByItemId(Long itemId);

    /** Used by saveDraftAnswers — replace-all pattern. */
    @Transactional
    void deleteAllByItemId(Long itemId);

    /**
     * Returns the count of answered questions for each item ID.
     * Used by the list-view DTO to surface "N answered / M total" without
     * loading full answer rows.
     */
    @Query("select a.itemId, count(a) from EstimateRequestQuestionAnswer a "
         + "where a.itemId in :itemIds group by a.itemId")
    List<Object[]> countByItemIds(java.util.Collection<Long> itemIds);
}
