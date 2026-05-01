package com.acme.estimator.phases;

/**
 * Hook called by {@link SdlcPhaseService#activate} just before flipping a
 * previously-inactive phase to active. Implementations veto the
 * activation by throwing {@link com.acme.estimator.common.ApiException}
 * with whichever error code makes sense for their concern.
 *
 * <p>This interface lives in {@code com.acme.estimator.phases} so the
 * package stays oblivious to {@code com.acme.estimator.catalog.templates}
 * — implementations live in the catalog layer and inject themselves into
 * Spring's bean graph. Inverting the dependency keeps the SDLC phase
 * package from reaching into a peer of its parent (which would also
 * complicate any future test that wants to mock out the guard).
 *
 * <p>Currently a single implementation: {@code TemplateActivationGuard}
 * in {@code com.acme.estimator.catalog.templates}, which blocks
 * activation when active estimate templates exist.
 */
public interface SdlcPhaseActivationGuard {

    /**
     * Veto the activation by throwing an {@link
     * com.acme.estimator.common.ApiException}. Return normally to allow.
     *
     * @param phase the phase about to be flipped from inactive to active
     */
    void check(SdlcPhase phase);
}
