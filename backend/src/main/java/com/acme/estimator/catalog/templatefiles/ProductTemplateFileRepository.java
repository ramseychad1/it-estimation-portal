package com.acme.estimator.catalog.templatefiles;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductTemplateFileRepository extends JpaRepository<ProductTemplateFile, Long> {
    Optional<ProductTemplateFile> findByProductId(Long productId);
    void deleteByProductId(Long productId);
    boolean existsByProductId(Long productId);
}
