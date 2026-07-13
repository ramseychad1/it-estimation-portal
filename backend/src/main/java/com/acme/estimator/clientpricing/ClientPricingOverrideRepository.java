package com.acme.estimator.clientpricing;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientPricingOverrideRepository extends JpaRepository<ClientPricingOverride, Long> {

    Optional<ClientPricingOverride> findByClientId(Long clientId);
}
