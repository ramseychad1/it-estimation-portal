package com.acme.estimator.programs;

import com.acme.estimator.clients.Client;
import com.acme.estimator.clients.ClientRepository;
import com.acme.estimator.common.ApiException;
import com.acme.estimator.programs.dto.ProgramDto;
import com.acme.estimator.programs.dto.ProgramRequest;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProgramService {

    private final ProgramRepository repository;
    private final ClientRepository clientRepository;

    @Transactional(readOnly = true)
    public List<ProgramDto> listActive(Long clientId) {
        List<Program> programs = clientId != null
            ? repository.findAllByClientIdAndActiveTrueOrderByNameAsc(clientId)
            : repository.findAllByActiveTrueOrderByNameAsc();
        return toDto(programs);
    }

    @Transactional(readOnly = true)
    public List<ProgramDto> listAll(Long clientId) {
        List<Program> programs = clientId != null
            ? repository.findAllByClientIdOrderByNameAsc(clientId)
            : repository.findAllByOrderByNameAsc();
        return toDto(programs);
    }

    @Transactional
    public ProgramDto create(ProgramRequest req) {
        Client client = clientRepository.findById(req.clientId())
            .filter(Client::isActive)
            .orElseThrow(() -> ApiException.badRequest("Invalid or inactive client."));
        if (repository.existsByClientIdAndNameIgnoreCaseAndActiveTrue(req.clientId(), req.name().trim())) {
            throw ApiException.conflict("A program with that name already exists for this client.");
        }
        Program entity = new Program();
        entity.setClientId(req.clientId());
        entity.setName(req.name().trim());
        entity.setActive(req.active());
        return ProgramDto.from(repository.save(entity), client.getName());
    }

    @Transactional
    public ProgramDto update(Long id, ProgramRequest req) {
        Program entity = getOrThrow(id);
        Client client = clientRepository.findById(req.clientId())
            .filter(Client::isActive)
            .orElseThrow(() -> ApiException.badRequest("Invalid or inactive client."));
        String newName = req.name().trim();
        if (!entity.getName().equalsIgnoreCase(newName)
                && repository.existsByClientIdAndNameIgnoreCaseAndActiveTrueAndIdNot(
                    req.clientId(), newName, id)) {
            throw ApiException.conflict("A program with that name already exists for this client.");
        }
        entity.setName(newName);
        entity.setActive(req.active());
        return ProgramDto.from(repository.save(entity), client.getName());
    }

    @Transactional
    public void delete(Long id) {
        getOrThrow(id);
        if (repository.countRequestsByProgram(id) > 0) {
            throw ApiException.conflict(
                "Cannot delete: this program is assigned to one or more estimate requests.");
        }
        repository.deleteById(id);
    }

    private List<ProgramDto> toDto(List<Program> programs) {
        if (programs.isEmpty()) return List.of();
        List<Long> clientIds = programs.stream().map(Program::getClientId).distinct().toList();
        Map<Long, String> clientNames = clientRepository.findAllById(clientIds).stream()
            .collect(Collectors.toMap(Client::getId, Client::getName));
        return programs.stream()
            .map(p -> ProgramDto.from(p, clientNames.getOrDefault(p.getClientId(), "")))
            .toList();
    }

    private Program getOrThrow(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> ApiException.notFound("Program not found."));
    }
}
