import { describe, expect, it } from "vitest";
import { pdf } from "@react-pdf/renderer";
import { EstimatePdfDocument } from "./EstimatePdf";
import type {
  EstimateRequestDetail,
  EstimateRequestItemDto,
  EstimateRequestPhaseLineView,
} from "../lib/api/estimates";

// ---- Minimal fixtures ------------------------------------------------------

function phaseLine(over: Partial<EstimateRequestPhaseLineView> = {}): EstimateRequestPhaseLineView {
  return {
    sdlcPhaseId: 1,
    sdlcPhaseName: "Discovery",
    displayOrder: 1,
    onshoreLow: 10, onshoreMed: 20, onshoreHigh: 30,
    offshoreLow: 5, offshoreMed: 10, offshoreHigh: 15,
    onshoreOverride: null,
    offshoreOverride: null,
    ...over,
  };
}

function approvedItem(): EstimateRequestItemDto {
  return {
    id: 1,
    productId: 1,
    productName: "Widget Platform",
    subFeatureId: null,
    subFeatureName: null,
    teamName: null,
    templateId: 1,
    templateVersionNumber: 1,
    status: "APPROVED",
    complexity: "MED",
    reviewerId: 7,
    reviewerName: "Jane Reviewer",
    reviewerStatus: "you",
    justification: "SECRET internal reviewer rationale.",
    submittedAt: "2026-01-01T00:00:00Z",
    reviewedAt: "2026-01-05T00:00:00Z",
    approvedBlendedRateId: 1,
    displayOrder: 1,
    phaseLines: [phaseLine(), phaseLine({ sdlcPhaseId: 2, sdlcPhaseName: "Build", displayOrder: 2 })],
    answers: [
      {
        questionId: 1,
        questionText: "What is the scope?",
        required: true,
        documentUploadEnabled: false,
        documentUploadRequired: false,
        questionType: "LONG_TEXT",
        options: [],
        answerText: "Two products.",
        attachments: [],
      },
    ],
    rejectionReason: null,
    revisionCount: 0,
    originalProductId: null,
    originalProductName: null,
    isReviewable: false,
    clarificationNote: "Internal clarification question.",
    clarificationResponse: "Requester reply.",
    pricingModel: "TARGET_MARGIN",
    tmMultiplier: 1.25,
    tmTargetMarginPct: 20,
    matBillableRate: null,
    matDiscountPct: null,
    rmPricingModel: null,
    rmTmMultiplier: null,
    rmTmTargetMarginPct: null,
    rmMatBillableRate: null,
    rmMatDiscountPct: null,
    itemType: "SCOPE",
  };
}

function detail(): EstimateRequestDetail {
  return {
    id: 42,
    title: "Test Estimate",
    description: "A description.",
    goLiveDate: "2026-06-01",
    requesterId: 3,
    derivedStatus: "APPROVED",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-05T00:00:00Z",
    items: [approvedItem()],
    categoryId: 1,
    categoryName: "Cat",
    programTypeIds: [],
    programTypeNames: [],
    clientId: 1,
    clientName: "Acme",
    programId: null,
    programName: null,
    pricingReviewStatus: null,
    rmReviewerId: null,
    rmDiscountPct: null,
    rmNotes: null,
    rmReviewedAt: null,
    requesterPricingContext: null,
    requestType: "CATALOG",
  };
}

const RATE = { onshoreRate: "150.00", offshoreRate: "60.00", effectiveDate: "2026-01-01" };

async function renderText(audience: "internal" | "client"): Promise<{ size: number; text: string }> {
  const el = (
    <EstimatePdfDocument
      detail={detail()}
      currentRate={RATE}
      generatedAt="2026-01-10T00:00:00Z"
      audience={audience}
    />
  );
  const blob = await pdf(el).toBlob();
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob);
  });
  // latin1 keeps a 1:1 byte→char mapping so the %PDF magic check works on bytes.
  return { size: buf.byteLength, text: new TextDecoder("latin1").decode(buf) };
}

// ---- Tests -----------------------------------------------------------------

describe("EstimatePdfDocument", () => {
  // Streams are compressed, so we can't grep the text for confidential strings.
  // Instead we assert structural validity + that the client variant is strictly
  // smaller — it strips the cost columns, the rates line, the reviewer block
  // (incl. the internal justification), and the clarification exchange. If the
  // audience gating regressed, the client PDF would grow to match the internal.
  it("renders a valid, non-trivial PDF for both audiences", async () => {
    const internal = await renderText("internal");
    const client = await renderText("client");
    expect(internal.size).toBeGreaterThan(1000);
    expect(client.size).toBeGreaterThan(1000);
    expect(internal.text.startsWith("%PDF")).toBe(true);
    expect(client.text.startsWith("%PDF")).toBe(true);
  });

  it("client audience produces a smaller PDF (internal sections stripped)", async () => {
    const internal = await renderText("internal");
    const client = await renderText("client");
    expect(client.size).toBeLessThan(internal.size);
  });
});
