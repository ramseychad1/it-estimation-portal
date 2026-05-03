package com.acme.estimator.reporting;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("hasAnyRole('ADMIN','SOLUTION_OWNER')")
@RequiredArgsConstructor
public class ReportingController {

    private final ReportingService reportingService;

    @GetMapping("/team-workload")
    public List<TeamWorkloadRow> summary() {
        return reportingService.getTeamWorkloadSummary();
    }

    @GetMapping("/team-workload/{teamId}")
    public TeamWorkloadDetail detail(@PathVariable Long teamId) {
        return reportingService.getTeamWorkloadDetail(teamId);
    }
}
