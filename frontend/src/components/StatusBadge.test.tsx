import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, estimateStatusBadge } from "./StatusBadge";

// ---------- estimateStatusBadge helper --------------------------------------

describe("estimateStatusBadge", () => {
  it("maps DRAFT to neutral variant with label 'Draft'", () => {
    const result = estimateStatusBadge("DRAFT");
    expect(result.variant).toBe("neutral");
    expect(result.label).toBe("Draft");
  });

  it("maps SUBMITTED to active variant with label 'Submitted'", () => {
    const result = estimateStatusBadge("SUBMITTED");
    expect(result.variant).toBe("active");
    expect(result.label).toBe("Submitted");
  });

  it("maps IN_REVIEW to in-review variant with label 'In review'", () => {
    const result = estimateStatusBadge("IN_REVIEW");
    expect(result.variant).toBe("in-review");
    expect(result.label).toBe("In review");
  });

  it("maps APPROVED to approved variant with label 'Approved'", () => {
    const result = estimateStatusBadge("APPROVED");
    expect(result.variant).toBe("approved");
    expect(result.label).toBe("Approved");
  });

  it("maps REJECTED to rejected variant with label 'Rejected'", () => {
    const result = estimateStatusBadge("REJECTED");
    expect(result.variant).toBe("rejected");
    expect(result.label).toBe("Rejected");
  });

  it("maps PARTIALLY_APPROVED to partially-approved variant", () => {
    const result = estimateStatusBadge("PARTIALLY_APPROVED");
    expect(result.variant).toBe("partially-approved");
    expect(result.label).toBe("Partially approved");
  });

  it("maps NEEDS_REVISION to needs-revision variant", () => {
    const result = estimateStatusBadge("NEEDS_REVISION");
    expect(result.variant).toBe("needs-revision");
    expect(result.label).toBe("Needs revision");
  });

  it("passes unknown statuses through as label with neutral variant", () => {
    const result = estimateStatusBadge("SOME_FUTURE_STATUS");
    expect(result.variant).toBe("neutral");
    expect(result.label).toBe("SOME_FUTURE_STATUS");
  });
});

// ---------- StatusBadge component rendering ---------------------------------

describe("<StatusBadge>", () => {
  it("renders children text", () => {
    render(<StatusBadge variant="active">Active</StatusBadge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("has role=status for accessibility", () => {
    render(<StatusBadge variant="neutral">Draft</StatusBadge>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("applies data-variant attribute matching the variant prop", () => {
    render(<StatusBadge variant="approved">Approved</StatusBadge>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("data-variant", "approved");
  });

  it("applies data-variant for rejected variant", () => {
    render(<StatusBadge variant="rejected">Rejected</StatusBadge>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("data-variant", "rejected");
  });

  it("applies data-variant for in-review variant", () => {
    render(<StatusBadge variant="in-review">In review</StatusBadge>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("data-variant", "in-review");
  });

  it("applies data-variant for needs-revision variant", () => {
    render(<StatusBadge variant="needs-revision">Needs revision</StatusBadge>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("data-variant", "needs-revision");
  });

  it("applies data-variant for partially-approved variant", () => {
    render(<StatusBadge variant="partially-approved">Partially approved</StatusBadge>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("data-variant", "partially-approved");
  });

  it("uses the ariaLabel prop as the accessible label when provided", () => {
    render(
      <StatusBadge variant="success" ariaLabel="Status: success">
        OK
      </StatusBadge>
    );
    expect(screen.getByRole("status", { name: "Status: success" })).toBeInTheDocument();
  });

  it("renders an icon alongside the children when provided", () => {
    render(
      <StatusBadge variant="active" icon={<span data-testid="badge-icon" />}>
        Active
      </StatusBadge>
    );
    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies extra className prop", () => {
    render(<StatusBadge variant="neutral" className="extra-class">Draft</StatusBadge>);
    const el = screen.getByRole("status");
    expect(el.className).toContain("extra-class");
  });
});
