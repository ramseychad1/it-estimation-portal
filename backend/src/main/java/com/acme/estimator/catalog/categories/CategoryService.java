package com.acme.estimator.catalog.categories;

import com.acme.estimator.catalog.categories.dto.CategoryDto;
import com.acme.estimator.catalog.categories.dto.CategoryRequest;
import com.acme.estimator.common.ApiException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository repository;

    @Transactional(readOnly = true)
    public List<CategoryDto> listAll() {
        return repository.findAllByOrderByDisplayOrderAscNameAsc()
            .stream().map(CategoryDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> listActive() {
        return repository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc()
            .stream().map(CategoryDto::from).toList();
    }

    @Transactional
    public CategoryDto create(CategoryRequest req) {
        if (repository.existsByNameIgnoreCase(req.name().trim())) {
            throw ApiException.conflict("A category with that name already exists.");
        }
        int nextOrder = repository.findMaxDisplayOrder() + 1;
        Category entity = new Category();
        entity.setName(req.name().trim());
        entity.setDisplayOrder(nextOrder);
        entity.setActive(req.active());
        return CategoryDto.from(repository.save(entity));
    }

    @Transactional
    public CategoryDto update(Long id, CategoryRequest req) {
        Category entity = getOrThrow(id);
        String newName = req.name().trim();
        if (!entity.getName().equalsIgnoreCase(newName)
                && repository.existsByNameIgnoreCase(newName)) {
            throw ApiException.conflict("A category with that name already exists.");
        }
        entity.setName(newName);
        entity.setActive(req.active());
        return CategoryDto.from(repository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        getOrThrow(id);
        // Categories are referenced by estimate_requests.category_id; the DB
        // RESTRICT constraint will surface this as a DataIntegrityViolationException
        // which GlobalExceptionHandler maps to 409. Explicit check here gives a
        // friendlier message.
        if (repository.countRequestsByCategory(id) > 0) {
            throw ApiException.conflict(
                "Cannot delete: this category is assigned to one or more estimate requests.");
        }
        repository.deleteById(id);
    }

    private Category getOrThrow(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Category not found."));
    }
}
