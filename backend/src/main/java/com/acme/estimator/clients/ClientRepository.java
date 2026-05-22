package com.acme.estimator.clients;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ClientRepository extends JpaRepository<Client, Long> {

    List<Client> findAllByActiveTrueOrderByNameAsc();

    List<Client> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCaseAndActiveTrue(String name);

    boolean existsByNameIgnoreCaseAndActiveTrueAndIdNot(String name, Long id);

    @Query(value = "SELECT COUNT(*) FROM estimate_requests WHERE client_id = :id", nativeQuery = true)
    long countRequestsByClient(Long id);

    @Query(value = "SELECT COUNT(*) FROM programs WHERE client_id = :id", nativeQuery = true)
    long countProgramsByClient(Long id);
}
