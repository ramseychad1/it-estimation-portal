package com.acme.estimator.catalog.templatefiles;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubFeatureTemplateFileRepository extends JpaRepository<SubFeatureTemplateFile, Long> {
    Optional<SubFeatureTemplateFile> findBySubFeatureId(Long subFeatureId);
    void deleteBySubFeatureId(Long subFeatureId);
    boolean existsBySubFeatureId(Long subFeatureId);
}
