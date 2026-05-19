package com.acme.estimator.catalog.programtypes;

import com.acme.estimator.catalog.programtypes.dto.ProgramTypeDto;
import com.acme.estimator.catalog.programtypes.dto.ProgramTypeRequest;
import com.acme.estimator.common.ApiException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProgramTypeService {

    private final ProgramTypeRepository repository;

    @Transactional(readOnly = true)
    public List<ProgramTypeDto> listAll() {
        return repository.findAllByOrderByDisplayOrderAscNameAsc()
            .stream().map(ProgramTypeDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ProgramTypeDto> listActive() {
        return repository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc()
            .stream().map(ProgramTypeDto::from).toList();
    }

    @Transactional
    public ProgramTypeDto create(ProgramTypeRequest req) {
        if (repository.existsByNameIgnoreCase(req.name().trim())) {
            throw ApiException.conflict("A program type with that name already exists.");
        }
        int nextOrder = repository.findMaxDisplayOrder() + 1;
        ProgramType entity = new ProgramType();
        entity.setName(req.name().trim());
        entity.setDisplayOrder(nextOrder);
        entity.setActive(req.active());
        return ProgramTypeDto.from(repository.save(entity));
    }

    @Transactional
    public ProgramTypeDto update(Long id, ProgramTypeRequest req) {
        ProgramType entity = getOrThrow(id);
        String newName = req.name().trim();
        if (!entity.getName().equalsIgnoreCase(newName)
                && repository.existsByNameIgnoreCase(newName)) {
            throw ApiException.conflict("A program type with that name already exists.");
        }
        entity.setName(newName);
        entity.setActive(req.active());
        return ProgramTypeDto.from(repository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        getOrThrow(id);
        if (repository.isReferencedByRequests(id)) {
            throw ApiException.conflict(
                "Cannot delete: this program type is assigned to one or more estimate requests.");
        }
        repository.deleteById(id);
    }

    private ProgramType getOrThrow(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Program type not found."));
    }
}
