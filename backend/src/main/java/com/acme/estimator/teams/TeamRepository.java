package com.acme.estimator.teams;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface TeamRepository
    extends JpaRepository<Team, Long>, JpaSpecificationExecutor<Team> {

    Optional<Team> findByNameIgnoreCase(String name);
}
