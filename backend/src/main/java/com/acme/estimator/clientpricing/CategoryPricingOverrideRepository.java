package com.acme.estimator.clientpricing;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoryPricingOverrideRepository extends JpaRepository<CategoryPricingOverride, Long> {

    Optional<CategoryPricingOverride> findByCategoryId(Long categoryId);

    @Query("SELECT o FROM CategoryPricingOverride o JOIN FETCH o.category")
    List<CategoryPricingOverride> findAllWithCategory();
}
