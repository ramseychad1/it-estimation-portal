package com.acme.estimator.phases;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SdlcPhaseRepository extends JpaRepository<SdlcPhase, Long> {

    List<SdlcPhase> findAllByOrderByDisplayOrderAsc();

    Optional<SdlcPhase> findByNameIgnoreCase(String name);

    @Query("select coalesce(max(p.displayOrder), 0) from SdlcPhase p")
    int findMaxDisplayOrder();
}
