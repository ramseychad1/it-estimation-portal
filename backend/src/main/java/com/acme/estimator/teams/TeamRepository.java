package com.acme.estimator.teams;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface TeamRepository
    extends JpaRepository<Team, Long>, JpaSpecificationExecutor<Team> {

    Optional<Team> findByNameIgnoreCase(String name);

    /** Used by the Change Log search predicate. */
    @Query("select t.id from Team t where lower(t.name) like lower(concat('%', ?1, '%'))")
    List<Long> findIdsByNameContainingIgnoreCase(String search);
}
