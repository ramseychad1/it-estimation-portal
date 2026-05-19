package com.acme.estimator.catalog.programtypes;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProgramTypeRepository extends JpaRepository<ProgramType, Long> {

    List<ProgramType> findAllByOrderByDisplayOrderAscNameAsc();

    List<ProgramType> findAllByActiveTrueOrderByDisplayOrderAscNameAsc();

    boolean existsByNameIgnoreCase(String name);

    @Query(value = "SELECT COUNT(*) > 0 FROM estimate_request_program_types WHERE program_type_id = :id",
           nativeQuery = true)
    boolean isReferencedByRequests(Long id);

    @Query("SELECT COALESCE(MAX(pt.displayOrder), 0) FROM ProgramType pt")
    int findMaxDisplayOrder();
}
