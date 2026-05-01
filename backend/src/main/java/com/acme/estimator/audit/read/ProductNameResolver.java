package com.acme.estimator.audit.read;

import com.acme.estimator.catalog.products.Product;
import com.acme.estimator.catalog.products.ProductRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class ProductNameResolver implements EntityNameResolver {

    static final String DELETED = "Deleted product";

    private final ProductRepository productRepository;

    @Override
    public String entityType() {
        return Product.ENTITY_TYPE;
    }

    @Override
    public Map<Long, String> resolveNames(Set<Long> ids) {
        Map<Long, String> out = new HashMap<>(ids.size());
        for (Long id : ids) out.put(id, DELETED);
        productRepository.findAllById(ids).forEach(p -> out.put(p.getId(), p.getName()));
        return out;
    }

    @Override
    public Set<Long> findIdsMatchingName(String search) {
        return new HashSet<>(productRepository.findIdsByNameContainingIgnoreCase(search));
    }
}
