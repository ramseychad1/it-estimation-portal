package com.acme.estimator.clients;

import com.acme.estimator.clients.dto.ClientDto;
import com.acme.estimator.clients.dto.ClientRequest;
import com.acme.estimator.common.ApiException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository repository;

    @Transactional(readOnly = true)
    public List<ClientDto> listActive() {
        return repository.findAllByActiveTrueOrderByNameAsc()
            .stream().map(ClientDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ClientDto> listAll() {
        return repository.findAllByOrderByNameAsc()
            .stream().map(ClientDto::from).toList();
    }

    @Transactional
    public ClientDto create(ClientRequest req) {
        if (repository.existsByNameIgnoreCaseAndActiveTrue(req.name().trim())) {
            throw ApiException.conflict("A client with that name already exists.");
        }
        Client entity = new Client();
        entity.setName(req.name().trim());
        entity.setPointOfContact(req.pointOfContact().trim());
        entity.setActive(req.active());
        return ClientDto.from(repository.save(entity));
    }

    @Transactional
    public ClientDto update(Long id, ClientRequest req) {
        Client entity = getOrThrow(id);
        String newName = req.name().trim();
        if (!entity.getName().equalsIgnoreCase(newName)
                && repository.existsByNameIgnoreCaseAndActiveTrueAndIdNot(newName, id)) {
            throw ApiException.conflict("A client with that name already exists.");
        }
        entity.setName(newName);
        entity.setPointOfContact(req.pointOfContact().trim());
        entity.setActive(req.active());
        return ClientDto.from(repository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        getOrThrow(id);
        if (repository.countProgramsByClient(id) > 0) {
            throw ApiException.conflict(
                "Cannot delete: this client has associated programs. Remove or reassign them first.");
        }
        if (repository.countRequestsByClient(id) > 0) {
            throw ApiException.conflict(
                "Cannot delete: this client is assigned to one or more estimate requests.");
        }
        repository.deleteById(id);
    }

    private Client getOrThrow(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Client not found."));
    }
}
