package com.acme.estimator.rates;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BlendedRateRepository extends JpaRepository<BlendedRate, Long> {

    /**
     * Full history, newest-effective-first. The first row in the result
     * is the most recently scheduled rate (which may be future-dated).
     */
    List<BlendedRate> findAllByOrderByEffectiveDateDescCreatedAtDesc();

    /**
     * "Current rate" lookup: highest effective_date that is &lt;= the given
     * date, ties broken by latest created_at. Returns empty if no rate row
     * has yet taken effect (Day 1 + scheduled-but-not-yet-effective cases).
     */
    @Query("""
        select r from BlendedRate r
        where r.effectiveDate <= ?1
        order by r.effectiveDate desc, r.createdAt desc
        limit 1
    """)
    Optional<BlendedRate> findCurrentAsOf(LocalDate date);

    /**
     * Pageable history for the table. Same default ordering as
     * {@link #findAllByOrderByEffectiveDateDescCreatedAtDesc()}.
     */
    Page<BlendedRate> findAllByOrderByEffectiveDateDescCreatedAtDesc(Pageable pageable);
}
