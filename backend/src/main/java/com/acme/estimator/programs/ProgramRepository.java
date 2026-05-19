package com.acme.estimator.programs;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ProgramRepository extends JpaRepository<Program, Long> {

    List<Program> findAllByActiveTrueOrderByNameAsc();

    List<Program> findAllByClientIdAndActiveTrueOrderByNameAsc(Long clientId);

    List<Program> findAllByOrderByNameAsc();

    List<Program> findAllByClientIdOrderByNameAsc(Long clientId);

    boolean existsByClientIdAndNameIgnoreCaseAndActiveTrue(Long clientId, String name);

    boolean existsByClientIdAndNameIgnoreCaseAndActiveTrueAndIdNot(Long clientId, String name, Long id);

    @Query(value = "SELECT COUNT(*) FROM estimate_requests WHERE program_id = :id", nativeQuery = true)
    long countRequestsByProgram(Long id);
}
