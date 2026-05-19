package com.acme.estimator.estimates;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "estimate_request_program_types")
@IdClass(EstimateRequestProgramTypeId.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PUBLIC)
public class EstimateRequestProgramType {

    @Id
    @Column(name = "request_id", nullable = false)
    private Long requestId;

    @Id
    @Column(name = "program_type_id", nullable = false)
    private Long programTypeId;
}
