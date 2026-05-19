package com.acme.estimator.catalog.categories;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findAllByOrderByDisplayOrderAscNameAsc();

    List<Category> findAllByActiveTrueOrderByDisplayOrderAscNameAsc();

    boolean existsByNameIgnoreCase(String name);

    @Query("SELECT COALESCE(MAX(c.displayOrder), 0) FROM Category c")
    int findMaxDisplayOrder();

    @Query(value = "SELECT COUNT(*) FROM estimate_requests WHERE category_id = :id", nativeQuery = true)
    long countRequestsByCategory(Long id);
}
