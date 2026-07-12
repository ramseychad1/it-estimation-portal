import type { EstimateRequestDetail } from "../lib/api/estimates";
import type { Complexity } from "../lib/api/estimates";
import {
  displayedRow,
  onshoreHoursForLines,
  offshoreHoursForLines,
  computeClientPrice,
  effectiveMarginPct,
  formatMarginPct,
  pricingModelLabel,
  rmAdjustmentLabel,
} from "../lib/estimateMath";

// Matches the shape used in EstimateDetailPage / EstimatePdf
type RateShape = {
  onshoreRate: string;
  offshoreRate: string;
  effectiveDate: string;
} | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function complexityLabel(c: Complexity): string {
  return c === "LOW" ? "Low" : c === "MED" ? "Medium" : "High";
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Creates a formula cell object for SheetJS (no leading "=" in the f string). */
function fmla(f: string, v = 0): { t: "n"; f: string; v: number } {
  return { t: "n", f, v };
}

/**
 * Builds a valid Excel sheet tab name from a product/sub-feature label.
 * Excel rules: max 31 chars, no /\?*[]: characters, can't start/end with '.
 * If the same base name would appear twice, appends " (N)" to make it unique.
 */
function buildSheetNames(
  items: Array<{ productName: string; subFeatureName: string | null }>,
): string[] {
  const INVALID = /[/\\?*[\]:]/g;
  const MAX = 31;

  const base = items.map((it) => {
    const raw = it.subFeatureName ?? it.productName;
    return raw.replace(INVALID, "").replace(/^'+|'+$/g, "").trim().slice(0, MAX) || "Sheet";
  });

  // Deduplicate: if two items produce the same base name, append " (2)", " (3)", …
  const seen = new Map<string, number>();
  return base.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const suffix = ` (${count})`;
    return name.slice(0, MAX - suffix.length) + suffix;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a multi-sheet .xlsx workbook that mirrors the estimate PDF:
 *  - Sheet 1 "Summary": request metadata + project-level rollup table whose
 *    Onshore/Offshore/Total/Cost cells are cross-sheet formula references
 *    pointing at each item sheet's total row.
 *  - Sheets 2..N "Item 1", "Item 2", …: one sheet per approved item with the
 *    full SDLC-phase breakdown; per-row Total Hrs and Phase Cost columns use
 *    SUM formulas so the totals stay live if a user edits hours in Excel.
 */
export async function buildEstimateExcel(
  detail: EstimateRequestDetail,
  rate: RateShape,
  requesterName?: string,
): Promise<Blob> {
  const XLSX = await import("xlsx");

  const approvedItems = detail.items.filter(
    (it) => it.status === "APPROVED" && it.complexity != null,
  );

  const onsRate = rate ? Number(rate.onshoreRate) : 0;
  const offsRate = rate ? Number(rate.offshoreRate) : 0;
  const hasRate = rate != null;
  const hasClientPrice = approvedItems.some((it) => it.pricingModel != null);
  const hasRmAdjustment = approvedItems.some((it) => rmAdjustmentLabel(it) != null);
  // Margin needs both an internal cost (rate) and a client price to be meaningful.
  const hasMargin = hasRate && hasClientPrice;

  // Pre-compute where the "Item Total" row sits on each item sheet (1-indexed).
  // Item layout: row 1=title, row 2=meta, row 3=blank, row 4=section header,
  // row 5=column headers, rows 6..(5+n)=phase data, row (6+n)=Item Total.
  const itemTotalRows = approvedItems.map((it) => it.phaseLines.length + 6);

  // Sheet tab names derived from product/sub-feature labels (deduped, ≤31 chars).
  const sheetNames = buildSheetNames(approvedItems);

  const wb = XLSX.utils.book_new();

  // ── Dates shared by Summary ──────────────────────────────────────────────────

  const submittedAt = detail.items
    .map((it) => it.submittedAt)
    .filter(Boolean)
    .sort()
    .at(0);
  const approvedAt = approvedItems
    .map((it) => it.reviewedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  // ── Summary Sheet ────────────────────────────────────────────────────────────
  //
  // Row 1:  EST-{id} identifier
  // Rows 3–10: metadata key/value pairs
  // Row 12: "Project Summary" section label
  // Row 13: column headers
  // Rows 14..13+N: one row per approved item (cross-sheet formula refs)
  // Row 14+N: Grand Total (SUM formulas)

  const sumRows: unknown[][] = [
    [`EST-${detail.id} — Estimate Report`],                                 // row 1
    [],                                                                      // row 2
    ["Title", detail.title],                                                 // row 3
    ["Client", detail.clientName ?? "—"],                                   // row 4
    ["Program", detail.programName ?? "—"],                                 // row 5
    ["Requester", requesterName ?? "—"],                                    // row 6
    ["Go-Live Target", detail.goLiveDate ? fmtDate(detail.goLiveDate + "T00:00:00") : "Unknown"], // row 7
    ["Submitted", submittedAt ? fmtDate(submittedAt) : "—"],               // row 8
    ["Approved", approvedAt ? fmtDate(approvedAt) : "—"],                  // row 9
    ["Status", "APPROVED"],                                                  // row 10
    [],                                                                      // row 11
    ["Project Summary"],                                                     // row 12
  ];

  // Row 13: column headers
  const summaryHeaders = ["Product / Sub-feature", "Complexity", "Onshore Hrs", "Offshore Hrs", "Total Hrs"];
  if (hasRate) summaryHeaders.push("Internal Cost");
  if (hasClientPrice) summaryHeaders.push("Client Price");
  if (hasRmAdjustment) summaryHeaders.push("RM Adjustment");
  if (hasMargin) summaryHeaders.push("Margin %");
  sumRows.push(summaryHeaders);

  // Data rows start at row 14 (1-indexed).
  const sumDataStart = 14;

  for (let i = 0; i < approvedItems.length; i++) {
    const item = approvedItems[i];
    const sheetName = sheetNames[i];
    const totalRow = itemTotalRows[i];

    const label = item.subFeatureName
      ? `${item.productName} · ${item.subFeatureName}`
      : item.productName;

    // Compute cached values (used as Excel formula result hints and for Grand Total).
    const ons = onshoreHoursForLines(item.phaseLines, item.complexity);
    const off = offshoreHoursForLines(item.phaseLines, item.complexity);
    const cost = Math.ceil(ons * onsRate + off * offsRate);
    const clientPrice = computeClientPrice(
      item.rmPricingModel ?? item.pricingModel, hasRate ? cost : null, Math.ceil(ons + off),
      item.rmTmMultiplier ?? item.tmMultiplier,
      item.rmTmTargetMarginPct ?? item.tmTargetMarginPct,
      item.rmMatBillableRate ?? item.matBillableRate,
      item.rmMatDiscountPct ?? item.matDiscountPct,
    );

    const row: unknown[] = [
      label,
      item.complexity ? complexityLabel(item.complexity) : "—",
      // These cross-sheet formulas pull from the Item Total row on each item sheet.
      fmla(`'${sheetName}'!B${totalRow}`, Math.ceil(ons)),
      fmla(`'${sheetName}'!C${totalRow}`, Math.ceil(off)),
      fmla(`'${sheetName}'!D${totalRow}`, Math.ceil(ons + off)),
    ];
    if (hasRate) row.push(fmla(`'${sheetName}'!E${totalRow}`, cost));
    if (hasClientPrice) row.push(clientPrice != null ? Math.ceil(clientPrice) : "");
    if (hasRmAdjustment) row.push(rmAdjustmentLabel(item) ?? "—");
    if (hasMargin) {
      row.push(formatMarginPct(clientPrice != null ? effectiveMarginPct(cost, clientPrice) : null) ?? "");
    }
    sumRows.push(row);
  }

  // Grand Total row.
  const sumDataEnd = sumDataStart + approvedItems.length - 1;
  const grandOns = approvedItems.reduce(
    (s, it) => s + onshoreHoursForLines(it.phaseLines, it.complexity), 0,
  );
  const grandOff = approvedItems.reduce(
    (s, it) => s + offshoreHoursForLines(it.phaseLines, it.complexity), 0,
  );
  const grandCost = Math.ceil(grandOns * onsRate + grandOff * offsRate);

  // Gross client price across all items — used by the Grand Total cell, the
  // grand margin cell, and the discount rows below.
  const grossClientPrice = approvedItems.reduce((s, it) => {
    const ons = onshoreHoursForLines(it.phaseLines, it.complexity);
    const off = offshoreHoursForLines(it.phaseLines, it.complexity);
    const cost = Math.ceil(ons * onsRate + off * offsRate);
    const cp = computeClientPrice(
      it.rmPricingModel ?? it.pricingModel, hasRate ? cost : null, Math.ceil(ons + off),
      it.rmTmMultiplier ?? it.tmMultiplier,
      it.rmTmTargetMarginPct ?? it.tmTargetMarginPct,
      it.rmMatBillableRate ?? it.matBillableRate,
      it.rmMatDiscountPct ?? it.matDiscountPct,
    );
    return s + (cp ?? 0);
  }, 0);

  const grandRow: unknown[] = [
    "Grand Total", "",
    fmla(`SUM(C${sumDataStart}:C${sumDataEnd})`, Math.ceil(grandOns)),
    fmla(`SUM(D${sumDataStart}:D${sumDataEnd})`, Math.ceil(grandOff)),
    fmla(`SUM(E${sumDataStart}:E${sumDataEnd})`, Math.ceil(grandOns + grandOff)),
  ];
  if (hasRate) {
    grandRow.push(fmla(`SUM(F${sumDataStart}:F${sumDataEnd})`, grandCost));
  }
  if (hasClientPrice) {
    grandRow.push(fmla(`SUM(G${sumDataStart}:G${sumDataEnd})`, Math.ceil(grossClientPrice)));
  }
  if (hasRmAdjustment) grandRow.push("");
  if (hasMargin) {
    grandRow.push(formatMarginPct(effectiveMarginPct(grandCost, grossClientPrice)) ?? "");
  }
  sumRows.push(grandRow);

  // RM discount rows — append after Grand Total when a discount was applied
  const rmDiscountPct = detail.rmDiscountPct;
  if (hasClientPrice && rmDiscountPct) {
    const grandTotalRow = sumDataStart + approvedItems.length;
    const discountAmt = Math.ceil((grossClientPrice * rmDiscountPct) / 100);
    const netPrice = Math.ceil(grossClientPrice) - discountAmt;
    const clientCol = hasRate ? "G" : "F";
    sumRows.push([`Pricing Discount (${rmDiscountPct}%)`, "", "", "", "", ...(hasRate ? [""] : []), -discountAmt, ...(hasRmAdjustment ? [""] : []), ...(hasMargin ? [""] : [])]);
    sumRows.push(["Net Client Price", "", "", "", "", ...(hasRate ? [""] : []),
      fmla(`${clientCol}${grandTotalRow}-${discountAmt}`, netPrice), ...(hasRmAdjustment ? [""] : []), ...(hasMargin ? [""] : [])]);
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(sumRows);
  summaryWs["!cols"] = [
    { wch: 34 }, // A: Product / Sub-feature
    { wch: 12 }, // B: Complexity
    { wch: 14 }, // C: Onshore Hrs
    { wch: 14 }, // D: Offshore Hrs
    { wch: 12 }, // E: Total Hrs
    { wch: 16 }, // F: Internal Cost
    { wch: 16 }, // G: Client Price
    ...(hasRmAdjustment ? [{ wch: 22 }] : []), // RM Adjustment
    ...(hasMargin ? [{ wch: 12 }] : []), // Margin %
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // ── Item Sheets ──────────────────────────────────────────────────────────────
  //
  // Row 1:  "Item N — Product [› Sub-feature]"
  // Row 2:  Complexity | Reviewer
  // Row 3:  blank
  // Row 4:  "SDLC Phase Breakdown" section label
  // Row 5:  column headers
  // Rows 6..(5+n): phase data  (Total Hrs = Onshore + Offshore formula)
  // Row (6+n): Item Total       (SUM formulas for each column)
  // — then optional: rates note, client price, reviewer notes, Q&A —

  for (let i = 0; i < approvedItems.length; i++) {
    const item = approvedItems[i];
    const complexity = item.complexity!;
    const title = item.subFeatureName
      ? `${item.productName} › ${item.subFeatureName}`
      : item.productName;

    const itemRows: unknown[][] = [
      // Row 1
      [`Item ${i + 1} — ${title}`],
      // Row 2
      [
        `Complexity: ${complexityLabel(complexity)}`,
        item.reviewerName
          ? `Reviewer: ${item.reviewerName}${item.reviewedAt ? " · " + fmtDate(item.reviewedAt) : ""}`
          : "",
      ],
      // Row 3
      [],
      // Row 4
      ["SDLC Phase Breakdown"],
    ];

    // Row 5: column headers
    const tableHeaders = ["SDLC Phase", "Onshore Hrs", "Offshore Hrs", "Total Hrs"];
    if (hasRate) tableHeaders.push("Phase Cost");
    itemRows.push(tableHeaders);

    // Rows 6..(5+n): one row per SDLC phase
    const dataStart = 6;
    const n = item.phaseLines.length;
    const dataEnd = 5 + n;

    for (let j = 0; j < n; j++) {
      const line = item.phaseLines[j];
      const d = displayedRow(line, complexity);
      const rowNum = dataStart + j; // 1-indexed row in this sheet

      const phaseRow: unknown[] = [
        line.sdlcPhaseName,
        d.onshore,
        d.offshore,
        fmla(`B${rowNum}+C${rowNum}`, d.onshore + d.offshore),
      ];
      if (hasRate) {
        phaseRow.push(
          fmla(
            `B${rowNum}*${onsRate}+C${rowNum}*${offsRate}`,
            Math.ceil(d.onshore * onsRate + d.offshore * offsRate),
          ),
        );
      }
      itemRows.push(phaseRow);
    }

    // Row (6+n): Item Total — formulas sum the data range above
    const ons = onshoreHoursForLines(item.phaseLines, complexity);
    const off = offshoreHoursForLines(item.phaseLines, complexity);
    const totalCost = Math.ceil(ons * onsRate + off * offsRate);

    const totalArr: unknown[] = [
      "Item Total",
      fmla(`SUM(B${dataStart}:B${dataEnd})`, Math.ceil(ons)),
      fmla(`SUM(C${dataStart}:C${dataEnd})`, Math.ceil(off)),
      fmla(`SUM(D${dataStart}:D${dataEnd})`, Math.ceil(ons + off)),
    ];
    if (hasRate) {
      totalArr.push(fmla(`SUM(E${dataStart}:E${dataEnd})`, totalCost));
    }
    itemRows.push(totalArr);

    // Rates note
    itemRows.push([]);
    if (hasRate) {
      itemRows.push([
        `Rates applied: Onshore $${rate!.onshoreRate}/hr · Offshore $${rate!.offshoreRate}/hr (effective ${rate!.effectiveDate})`,
      ]);
    }

    // Client price (RM overrides take precedence)
    const effModel = item.rmPricingModel ?? item.pricingModel;
    const clientPrice = computeClientPrice(
      effModel, hasRate ? totalCost : null, Math.ceil(ons + off),
      item.rmTmMultiplier ?? item.tmMultiplier,
      item.rmTmTargetMarginPct ?? item.tmTargetMarginPct,
      item.rmMatBillableRate ?? item.matBillableRate,
      item.rmMatDiscountPct ?? item.matDiscountPct,
    );
    if (clientPrice != null) {
      itemRows.push([`Client Price (${pricingModelLabel(effModel)})`, Math.ceil(clientPrice)]);
      const marginText = hasRate ? formatMarginPct(effectiveMarginPct(totalCost, clientPrice)) : null;
      if (marginText) itemRows.push(["Margin", marginText]);
    }

    // Reviewer justification
    if (item.justification) {
      itemRows.push([]);
      itemRows.push(["Reviewer's Notes"]);
      itemRows.push([item.justification]);
    }

    // Q&A
    const hasAnswers = item.answers.some((a) => a.answerText || a.attachments.length > 0);
    if (hasAnswers) {
      itemRows.push([]);
      itemRows.push(["Questions & Answers"]);
      for (const ans of item.answers) {
        if (!ans.answerText && ans.attachments.length === 0) continue;
        itemRows.push([ans.questionText]);
        if (ans.answerText) itemRows.push(["", ans.answerText]);
        for (const att of ans.attachments) {
          itemRows.push(["", `[attachment] ${att.originalFilename}`]);
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(itemRows);
    ws["!cols"] = [
      { wch: 28 }, // A: SDLC Phase / label
      { wch: 14 }, // B: Onshore Hrs
      { wch: 14 }, // C: Offshore Hrs
      { wch: 12 }, // D: Total Hrs
      { wch: 16 }, // E: Phase Cost
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetNames[i]);
  }

  // Write workbook to an ArrayBuffer and wrap in a Blob.
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
