package com.acme.estimator.teams;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamRepository
    extends JpaRepository<Team, Long>, JpaSpecificationExecutor<Team> {

    Optional<Team> findByNameIgnoreCase(String name);

    /** Used by the Change Log search predicate. */
    @Query("select t.id from Team t where lower(t.name) like lower(concat('%', ?1, '%'))")
    List<Long> findIdsByNameContainingIgnoreCase(String search);

    /**
     * Returns [teamId, memberCount] rows for the given team IDs.
     * Teams with zero members are absent from the result — use getOrDefault(id, 0L).
     */
    @Query("SELECT t.id, COUNT(u) FROM Team t JOIN t.members u WHERE t.id IN :teamIds GROUP BY t.id")
    List<Object[]> countMembersByTeamIdIn(@Param("teamIds") List<Long> teamIds);

    /** Returns all teams that a specific user belongs to. */
    @Query("SELECT t FROM Team t JOIN t.members u WHERE u.id = :userId ORDER BY t.name")
    List<Team> findTeamsByUserId(@Param("userId") Long userId);

    /** Number of active products assigned to this team. Populated in M2; used for delete guard. */
    @Query("SELECT COUNT(p) FROM com.acme.estimator.catalog.products.Product p WHERE p.team.id = :teamId AND p.active = true")
    long countActiveProductsByTeamId(@Param("teamId") Long teamId);

    /**
     * Returns [teamId, productCount] rows for the given team IDs.
     * Only active products are counted. Used to hydrate TeamListItem.productCount.
     */
    @Query("SELECT p.team.id, COUNT(p) FROM com.acme.estimator.catalog.products.Product p WHERE p.team.id IN :teamIds AND p.active = true GROUP BY p.team.id")
    List<Object[]> countActiveProductsByTeamIdIn(@Param("teamIds") List<Long> teamIds);
}
