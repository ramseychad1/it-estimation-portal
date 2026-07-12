package com.acme.estimator.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PageLimitsTest {

    @Test
    void sizeClampsToMax() {
        assertThat(PageLimits.size(1_000_000)).isEqualTo(PageLimits.MAX_SIZE);
        assertThat(PageLimits.size(PageLimits.MAX_SIZE + 1)).isEqualTo(PageLimits.MAX_SIZE);
    }

    @Test
    void sizeFloorsToOne() {
        assertThat(PageLimits.size(0)).isEqualTo(1);
        assertThat(PageLimits.size(-5)).isEqualTo(1);
    }

    @Test
    void sizePassesThroughInRange() {
        assertThat(PageLimits.size(25)).isEqualTo(25);
    }

    @Test
    void pageFloorsToZero() {
        assertThat(PageLimits.page(-3)).isZero();
        assertThat(PageLimits.page(4)).isEqualTo(4);
    }

    @Test
    void ofBuildsAClampedRequest() {
        var pr = PageLimits.of(-1, 5_000);
        assertThat(pr.getPageNumber()).isZero();
        assertThat(pr.getPageSize()).isEqualTo(PageLimits.MAX_SIZE);
    }
}
