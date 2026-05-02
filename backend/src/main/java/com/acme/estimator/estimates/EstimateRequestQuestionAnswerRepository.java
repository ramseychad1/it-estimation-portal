package com.acme.estimator.estimates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface EstimateRequestQuestionAnswerRepository
    extends JpaRepository<EstimateRequestQuestionAnswer, Long> {

    List<EstimateRequestQuestionAnswer> findAllByEstimateRequestId(Long estimateRequestId);

    /** Used by saveDraftAnswers — replace-all pattern. */
    @Transactional
    void deleteAllByEstimateRequestId(Long estimateRequestId);
}
