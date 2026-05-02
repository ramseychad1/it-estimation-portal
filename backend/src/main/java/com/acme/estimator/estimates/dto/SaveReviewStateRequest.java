package com.acme.estimator.estimates.dto;

import com.acme.estimator.estimates.Complexity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Autosave payload during In Review. Any of the three fields may be
 * present in isolation — the autosave fires on whichever changed.
 *
 * <p><b>Null-vs-clear semantics — read carefully.</b> The conventions
 * differ between the top-level fields and the line override entries:
 *
 * <ul>
 *   <li><b>Top-level fields ({@code complexity}, {@code justification}):</b>
 *       a {@code null} or omitted value means "no change to that field" —
 *       NOT "clear it." Autosave can fire on any single field; sending
 *       only one shouldn't blank the others.</li>
 *   <li><b>{@code lineOverrides}:</b> an empty list (or omitted) means
 *       "no override changes." Sending a list mutates only the specified
 *       lines.</li>
 *   <li><b>Within a {@link LineOverrideInput}:</b> a {@code null}
 *       override value DOES clear that override (reverts the cell to
 *       the snapshot value). The whole point of sending the line is to
 *       mutate it; null is the explicit clear signal.</li>
 * </ul>
 *
 * <p>Worked examples:
 * <pre>
 *   { "complexity": "MED" }
 *     → sets complexity to MED; leaves justification AND every override
 *       exactly as they were.
 *
 *   { "lineOverrides": [{ "sdlcPhaseId": 5, "onshoreOverride": 42.00 }] }
 *     → sets line 5's onshoreOverride to 42.00; offshoreOverride on the
 *       same line is left alone (NOT cleared) because the field is null.
 *       Wait — that's wrong: see the next example.
 *
 *   { "lineOverrides": [{ "sdlcPhaseId": 5,
 *                          "onshoreOverride": 42.00,
 *                          "offshoreOverride": null }] }
 *     → sets onshore=42.00 AND clears offshore on line 5. Both fields
 *       on the override entry are applied as-sent (null = clear).
 * </pre>
 *
 * <p><b>Caveat on the second example above:</b> Jackson can't distinguish
 * "field omitted" from "field present with null value" in a Java record;
 * both arrive at the service as {@code null}. So today the rule simplifies
 * to: <i>any LineOverrideInput in the list applies BOTH onshoreOverride
 * and offshoreOverride as-sent</i>. If you want to mutate only one of
 * the two on a line, fetch the current value first and re-send it
 * alongside the change. Documented here because the asymmetry is the
 * kind of subtle thing that traps a future contributor.
 */
public record SaveReviewStateRequest(
    Complexity complexity,
    @Size(max = 4000) String justification,
    @Valid List<LineOverrideInput> lineOverrides
) {}
