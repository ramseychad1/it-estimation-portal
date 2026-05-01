package com.acme.estimator.catalog.templates;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EstimateTemplateLineRepository extends JpaRepository<EstimateTemplateLine, Long> {

    List<EstimateTemplateLine> findAllByTemplateId(Long templateId);

    /**
     * Returns lines ordered by their SDLC phase's display_order. The grid
     * editor renders rows in phase order regardless of insertion sequence,
     * so the read path bakes the join in for free.
     */
    @Query("""
        select l from EstimateTemplateLine l
        where l.templateId = ?1
        order by (
          select p.displayOrder from SdlcPhase p where p.id = l.sdlcPhaseId
        )
    """)
    List<EstimateTemplateLine> findAllByTemplateIdOrderBySdlcPhaseDisplayOrder(Long templateId);
}
