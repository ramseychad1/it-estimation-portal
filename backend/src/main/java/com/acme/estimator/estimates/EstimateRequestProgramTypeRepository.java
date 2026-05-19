package com.acme.estimator.estimates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface EstimateRequestProgramTypeRepository
    extends JpaRepository<EstimateRequestProgramType, EstimateRequestProgramTypeId> {

    List<EstimateRequestProgramType> findByRequestId(Long requestId);

    List<EstimateRequestProgramType> findByRequestIdIn(List<Long> requestIds);

    @Transactional
    void deleteByRequestId(Long requestId);
}
