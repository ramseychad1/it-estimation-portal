import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PricingBasisBadge } from "./PricingBasisBadge";

describe("<PricingBasisBadge>", () => {
  it("shows the model label and margin derived from cost + price", () => {
    // cost 700, price 1000 → 30% margin
    const { container } = render(
      <PricingBasisBadge model="TARGET_MARGIN" internalCost={700} clientPrice={1000} />,
    );
    expect(container.textContent).toContain("Target Margin");
    expect(container.textContent).toContain("30% margin");
  });

  it("accepts a pre-computed marginPct directly", () => {
    const { container } = render(<PricingBasisBadge model="TARGET_MARGIN" marginPct={45} />);
    expect(container.textContent).toContain("45% margin");
  });

  it("shows Time & Materials label", () => {
    const { container } = render(
      <PricingBasisBadge model="TIME_AND_MATERIALS" internalCost={800} clientPrice={1000} />,
    );
    expect(container.textContent).toContain("Time & Materials");
    expect(container.textContent).toContain("20% margin");
  });

  it("renders only the model when margin can't be computed", () => {
    const { container } = render(<PricingBasisBadge model="TARGET_MARGIN" />);
    expect(container.textContent).toContain("Target Margin");
    expect(container.textContent).not.toContain("margin");
  });

  it("uses the warning tone for a negative margin (price below cost)", () => {
    // cost 1200, price 1000 → −20% margin
    const { container } = render(
      <PricingBasisBadge model="TARGET_MARGIN" internalCost={1200} clientPrice={1000} />,
    );
    const badge = container.querySelector("span") as HTMLElement;
    expect(container.textContent).toContain("-20% margin");
    expect(badge.style.background).toContain("warning-soft");
  });

  it("falls back to Unassigned for a null model", () => {
    const { container } = render(<PricingBasisBadge model={null} />);
    expect(container.textContent).toContain("Unassigned");
  });
});
