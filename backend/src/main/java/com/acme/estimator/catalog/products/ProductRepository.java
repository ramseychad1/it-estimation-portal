package com.acme.estimator.catalog.products;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository
    extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    Optional<Product> findByNameIgnoreCaseAndActiveTrue(String name);

    List<Product> findByMode(ProductMode mode);

    /** Used by the Change Log search predicate. */
    @Query("select p.id from Product p where lower(p.name) like lower(concat('%', ?1, '%'))")
    List<Long> findIdsByNameContainingIgnoreCase(String search);

    /** Reporting: active products owned by a specific team. */
    @Query("SELECT p FROM Product p WHERE p.team.id = :teamId AND p.active = true ORDER BY p.name")
    List<Product> findActiveByTeamId(@Param("teamId") Long teamId);
}
