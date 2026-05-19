package com.acme.estimator.estimates;

import java.io.Serializable;
import java.util.Objects;

public class EstimateRequestProgramTypeId implements Serializable {

    private Long requestId;
    private Long programTypeId;

    public EstimateRequestProgramTypeId() {}

    public EstimateRequestProgramTypeId(Long requestId, Long programTypeId) {
        this.requestId = requestId;
        this.programTypeId = programTypeId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof EstimateRequestProgramTypeId other)) return false;
        return Objects.equals(requestId, other.requestId)
            && Objects.equals(programTypeId, other.programTypeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(requestId, programTypeId);
    }
}
