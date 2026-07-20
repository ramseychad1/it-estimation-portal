import { listPhases } from "../lib/api/phases";
import { getRatesPage } from "../lib/api/rates";
import { getClientPricingDefaults } from "../lib/api/clientPricing";
import { listProducts } from "../lib/api/products";
import { listSubFeaturesForProduct } from "../lib/api/subFeatures";
import { getSubFeatureTemplate, type TemplateLineView } from "../lib/api/templates";
import { computeClientPrice } from "../lib/estimateMath";
import { fmla, buildSheetNames, colLetter, hyperlinkCell } from "../lib/excelUtils";

interface CatalogItem {
  subFeatureId: number;
  containerName: string;
  teamName: string;
  subFeatureName: string;
  lines: TemplateLineView[];
}

/** Blank cell when a value is unset (Excel treats a truly empty cell as 0 in arithmetic, but "" in comparisons — exactly the semantics `computeClientPrice`'s `?? 0` defaults rely on). */
function numOrBlank(v: number | null | undefined): number | "" {
  return v == null ? "" : v;
}

/**
 * Fetches the full catalog (containers → sub-features → active templates)
 * and builds a multi-sheet, formula-based .xlsx workbook:
 *  - Sheet 1 "Summary": one row per SubFeature, hyperlinked to its own tab.
 *  - Sheet 2 "Assumptions": the rate/margin constants as of export time —
 *    every dollar formula in every other sheet references these cells.
 *  - Sheets 3..N: one per SubFeature, reproducing the template editor's
 *    hours grid + Client Pricing Preview panel.
 */
export async function buildCatalogExcel(): Promise<Blob> {
  const XLSX = await import("xlsx");

  const [phaseList, ratesPage, pricingDefaults, productsPage] = await Promise.all([
    listPhases("ACTIVE"),
    getRatesPage({ size: 1 }),
    getClientPricingDefaults(),
    listProducts({ status: "ACTIVE", mode: "CONTAINER", size: 100 }),
  ]);

  const phases = [...phaseList].sort((a, b) => a.displayOrder - b.displayOrder);
  const phaseCount = phases.length;
  const rate = ratesPage.current;
  const onshoreRate = rate ? Number(rate.onshoreRate) : 0;
  const offshoreRate = rate ? Number(rate.offshoreRate) : 0;

  const containers = productsPage.items;
  const subFeatureLists = await Promise.all(
    containers.map((c) => listSubFeaturesForProduct(c.id)),
  );

  const templateFetches: Array<{ containerName: string; teamName: string; subFeatureName: string; subFeatureId: number }> = [];
  containers.forEach((c, i) => {
    for (const sf of subFeatureLists[i]) {
      if (!sf.active) continue;
      templateFetches.push({
        containerName: c.name,
        teamName: c.team?.name ?? "—",
        subFeatureName: sf.name,
        subFeatureId: sf.id,
      });
    }
  });

  const templates = await Promise.all(
    templateFetches.map((t) => getSubFeatureTemplate(t.subFeatureId)),
  );

  const items: CatalogItem[] = templateFetches
    .map((t, i) => ({
      subFeatureId: t.subFeatureId,
      containerName: t.containerName,
      teamName: t.teamName,
      subFeatureName: t.subFeatureName,
      lines: templates[i]?.lines ?? null,
    }))
    .filter((it): it is CatalogItem => it.lines != null)
    .sort((a, b) => a.containerName.localeCompare(b.containerName) || a.subFeatureName.localeCompare(b.subFeatureName));

  // Sort each item's lines into the canonical phase order so column
  // position is consistent across every tab.
  for (const item of items) {
    item.lines.sort((a, b) => a.sdlcPhaseDisplayOrder - b.sdlcPhaseDisplayOrder);
  }

  const sheetNames = buildSheetNames(
    items.map((it) => ({ productName: it.containerName, subFeatureName: it.subFeatureName })),
  );

  // Fixed column layout for every item tab (grouped-by-shore, not
  // interleaved-by-phase, so SUM ranges stay contiguous):
  //   A            label
  //   B..(1+P)     onshore phase columns (P = phaseCount)
  //   (2+P)..(1+2P) offshore phase columns
  //   (2+2P)       Total Onshore
  //   (3+2P)       Total Offshore
  //   (4+2P)       Total Hrs
  //   (5+2P)       Total Cost
  const onshoreStart = 1;
  const onshoreEnd = phaseCount;
  const offshoreStart = phaseCount + 1;
  const offshoreEnd = phaseCount * 2;
  const totalOnsCol = colLetter(offshoreEnd + 1);
  const totalOffCol = colLetter(offshoreEnd + 2);
  const totalHrsCol = colLetter(offshoreEnd + 3);
  const totalCostCol = colLetter(offshoreEnd + 4);
  const onshoreRangeStart = colLetter(onshoreStart);
  const onshoreRangeEnd = colLetter(onshoreEnd);
  const offshoreRangeStart = colLetter(offshoreStart);
  const offshoreRangeEnd = colLetter(offshoreEnd);

  const TIER_ROWS = { LOW: 6, MED: 7, HIGH: 8 } as const;
  type Tier = keyof typeof TIER_ROWS;
  const TIERS: Tier[] = ["LOW", "MED", "HIGH"];

  function tierHours(line: TemplateLineView, tier: Tier) {
    return tier === "LOW"
      ? { onshore: line.onshoreLow, offshore: line.offshoreLow }
      : tier === "MED"
        ? { onshore: line.onshoreMed, offshore: line.offshoreMed }
        : { onshore: line.onshoreHigh, offshore: line.offshoreHigh };
  }

  const wb = XLSX.utils.book_new();

  // ── Assumptions sheet ────────────────────────────────────────────────────
  const assumptionRows: unknown[][] = [
    ["Pricing Assumptions (snapshot at export time)"],
    [],
    ["Blended Rate"],
    ["Onshore Rate ($/hr)", numOrBlank(rate ? onshoreRate : null)],
    ["Offshore Rate ($/hr)", numOrBlank(rate ? offshoreRate : null)],
    ["Rate Effective Date", rate?.effectiveDate ?? ""],
    [],
    ["Client Pricing Defaults (global)"],
    ["Target Margin Multiplier", numOrBlank(pricingDefaults.tmMultiplier)],
    ["Target Margin %", numOrBlank(pricingDefaults.tmTargetMarginPct)],
    ["T&M Billable Rate ($/hr)", numOrBlank(pricingDefaults.matBillableRate)],
    ["T&M Discount %", numOrBlank(pricingDefaults.matDiscountPct)],
    [],
    ["Exported", new Date().toISOString()],
  ];
  const assumptionsWs = XLSX.utils.aoa_to_sheet(assumptionRows);
  assumptionsWs["!cols"] = [{ wch: 28 }, { wch: 22 }];

  // ── Item sheets ──────────────────────────────────────────────────────────
  // Built (not yet appended) so Summary can be appended first below —
  // workbook tab order follows append order, not build order.
  const itemSheets: Array<{ name: string; ws: import("xlsx").WorkSheet }> = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rows: unknown[][] = [];

    rows.push([`${item.containerName} › ${item.subFeatureName}`]); // row 1
    rows.push([]); // row 2
    rows.push(["SDLC Phase Breakdown"]); // row 3

    // Row 4: merged banner over the onshore / offshore blocks.
    const bannerRow: unknown[] = new Array(1 + phaseCount * 2 + 4).fill("");
    bannerRow[onshoreStart] = "ONSHORE HOURS";
    bannerRow[offshoreStart] = "OFFSHORE HOURS";
    rows.push(bannerRow);

    // Row 5: phase-name headers.
    const headerRow: unknown[] = [""];
    for (const line of item.lines) headerRow.push(line.sdlcPhaseName);
    for (const line of item.lines) headerRow.push(line.sdlcPhaseName);
    headerRow.push("Total Onshore", "Total Offshore", "Total Hrs", "Total Cost");
    rows.push(headerRow);

    // Rows 6-8: LOW / MED / HIGH tiers.
    for (const tier of TIERS) {
      const rowNum = TIER_ROWS[tier];
      const row: unknown[] = [tier];
      let onsTotal = 0;
      let offsTotal = 0;
      for (const line of item.lines) {
        const { onshore } = tierHours(line, tier);
        row.push(onshore);
        onsTotal += onshore;
      }
      for (const line of item.lines) {
        const { offshore } = tierHours(line, tier);
        row.push(offshore);
        offsTotal += offshore;
      }
      const cost = Math.ceil(onsTotal * onshoreRate + offsTotal * offshoreRate);
      row.push(
        fmla(`SUM(${onshoreRangeStart}${rowNum}:${onshoreRangeEnd}${rowNum})`, Math.round(onsTotal * 100) / 100),
        fmla(`SUM(${offshoreRangeStart}${rowNum}:${offshoreRangeEnd}${rowNum})`, Math.round(offsTotal * 100) / 100),
        fmla(`${totalOnsCol}${rowNum}+${totalOffCol}${rowNum}`, Math.round((onsTotal + offsTotal) * 100) / 100),
        fmla(
          `ROUNDUP(${totalOnsCol}${rowNum}*Assumptions!$B$4+${totalOffCol}${rowNum}*Assumptions!$B$5,0)`,
          cost,
        ),
      );
      rows.push(row); // rows[rowNum - 1], rowNum = 6/7/8
    }

    rows.push([]); // row 9
    // Client Pricing Preview block (rows 10-13, columns A-D — independent
    // of the phase-count-dependent grid above).
    rows.push(["Client Pricing Preview (assumptions snapshot · indicative only)"]); // row 10
    rows.push(["", "Low", "Med", "High"]); // row 11

    const tmRow: unknown[] = ["Target Margin"];
    const matRow: unknown[] = ["Time & Materials"];
    for (const tier of TIERS) {
      const rowNum = TIER_ROWS[tier];
      let onsTotal = 0;
      let offsTotal = 0;
      for (const line of item.lines) {
        const h = tierHours(line, tier);
        onsTotal += h.onshore;
        offsTotal += h.offshore;
      }
      const cost = Math.ceil(onsTotal * onshoreRate + offsTotal * offshoreRate);
      const totalHrs = Math.round((onsTotal + offsTotal) * 100) / 100;
      const cachedTm = computeClientPrice(
        "TARGET_MARGIN", cost, totalHrs, pricingDefaults.tmMultiplier, pricingDefaults.tmTargetMarginPct, null, null,
      );
      const cachedMat = computeClientPrice(
        "TIME_AND_MATERIALS", cost, totalHrs, null, null, pricingDefaults.matBillableRate, pricingDefaults.matDiscountPct,
      );
      tmRow.push(
        fmla(
          `IF(AND(Assumptions!$B$9="",Assumptions!$B$10=""),"",ROUNDUP(IF(Assumptions!$B$9<>"",${totalCostCol}${rowNum}*Assumptions!$B$9,${totalCostCol}${rowNum}/(1-Assumptions!$B$10/100)),0))`,
          cachedTm != null ? Math.ceil(cachedTm) : 0,
        ),
      );
      matRow.push(
        fmla(
          `IF(Assumptions!$B$11="","",ROUNDUP(${totalHrsCol}${rowNum}*Assumptions!$B$11*(1-Assumptions!$B$12/100),0))`,
          cachedMat != null ? Math.ceil(cachedMat) : 0,
        ),
      );
    }
    rows.push(tmRow); // row 12
    rows.push(matRow); // row 13

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"] = [
      { s: { r: 3, c: onshoreStart }, e: { r: 3, c: onshoreEnd } },
      { s: { r: 3, c: offshoreStart }, e: { r: 3, c: offshoreEnd } },
    ];
    const cols: Array<{ wch: number }> = [{ wch: 26 }];
    for (let c = 0; c < phaseCount * 2; c++) cols.push({ wch: 12 });
    cols.push({ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 });
    ws["!cols"] = cols;
    itemSheets.push({ name: sheetNames[i], ws });
  }

  // ── Summary sheet ────────────────────────────────────────────────────────
  const summaryRows: unknown[][] = [
    [`Catalog Export — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`],
    [],
    [
      "Container", "Sub-Product", "Team",
      "Onshore Low", "Offshore Low", "Onshore Med", "Offshore Med", "Onshore High", "Offshore High",
      "Target Margin Low", "Target Margin Med", "Target Margin High",
      "T&M Low", "T&M Med", "T&M High",
      // Hidden columns P-Q: machine-readable round-trip keys for the Import
      // Catalog feature. Not for human eyes — sheet tab names get
      // truncated/deduped to fit Excel's 31-char limit, so they're not a
      // reliable key on their own; these two columns are.
      "SubFeature ID", "Sheet Name",
    ],
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sheetName = sheetNames[i];

    let onsLow = 0, offsLow = 0, onsMed = 0, offsMed = 0, onsHigh = 0, offsHigh = 0;
    for (const line of item.lines) {
      onsLow += line.onshoreLow; offsLow += line.offshoreLow;
      onsMed += line.onshoreMed; offsMed += line.offshoreMed;
      onsHigh += line.onshoreHigh; offsHigh += line.offshoreHigh;
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const costLow = Math.ceil(onsLow * onshoreRate + offsLow * offshoreRate);
    const costMed = Math.ceil(onsMed * onshoreRate + offsMed * offshoreRate);
    const costHigh = Math.ceil(onsHigh * onshoreRate + offsHigh * offshoreRate);
    const hrsLow = round2(onsLow + offsLow);
    const hrsMed = round2(onsMed + offsMed);
    const hrsHigh = round2(onsHigh + offsHigh);
    const tmLow = computeClientPrice("TARGET_MARGIN", costLow, hrsLow, pricingDefaults.tmMultiplier, pricingDefaults.tmTargetMarginPct, null, null);
    const tmMed = computeClientPrice("TARGET_MARGIN", costMed, hrsMed, pricingDefaults.tmMultiplier, pricingDefaults.tmTargetMarginPct, null, null);
    const tmHigh = computeClientPrice("TARGET_MARGIN", costHigh, hrsHigh, pricingDefaults.tmMultiplier, pricingDefaults.tmTargetMarginPct, null, null);
    const matLow = computeClientPrice("TIME_AND_MATERIALS", costLow, hrsLow, null, null, pricingDefaults.matBillableRate, pricingDefaults.matDiscountPct);
    const matMed = computeClientPrice("TIME_AND_MATERIALS", costMed, hrsMed, null, null, pricingDefaults.matBillableRate, pricingDefaults.matDiscountPct);
    const matHigh = computeClientPrice("TIME_AND_MATERIALS", costHigh, hrsHigh, null, null, pricingDefaults.matBillableRate, pricingDefaults.matDiscountPct);

    summaryRows.push([
      item.containerName,
      hyperlinkCell(item.subFeatureName, sheetName),
      item.teamName,
      fmla(`'${sheetName}'!${totalOnsCol}${TIER_ROWS.LOW}`, round2(onsLow)),
      fmla(`'${sheetName}'!${totalOffCol}${TIER_ROWS.LOW}`, round2(offsLow)),
      fmla(`'${sheetName}'!${totalOnsCol}${TIER_ROWS.MED}`, round2(onsMed)),
      fmla(`'${sheetName}'!${totalOffCol}${TIER_ROWS.MED}`, round2(offsMed)),
      fmla(`'${sheetName}'!${totalOnsCol}${TIER_ROWS.HIGH}`, round2(onsHigh)),
      fmla(`'${sheetName}'!${totalOffCol}${TIER_ROWS.HIGH}`, round2(offsHigh)),
      fmla(`'${sheetName}'!B12`, tmLow != null ? Math.ceil(tmLow) : 0),
      fmla(`'${sheetName}'!C12`, tmMed != null ? Math.ceil(tmMed) : 0),
      fmla(`'${sheetName}'!D12`, tmHigh != null ? Math.ceil(tmHigh) : 0),
      fmla(`'${sheetName}'!B13`, matLow != null ? Math.ceil(matLow) : 0),
      fmla(`'${sheetName}'!C13`, matMed != null ? Math.ceil(matMed) : 0),
      fmla(`'${sheetName}'!D13`, matHigh != null ? Math.ceil(matHigh) : 0),
      item.subFeatureId,
      sheetName,
    ]);
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs["!cols"] = [
    { wch: 26 }, { wch: 34 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12, hidden: true }, { wch: 34, hidden: true }, // SubFeature ID, Sheet Name
  ];
  // Append in the requested tab order: Summary, Assumptions, then one per item.
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");
  XLSX.utils.book_append_sheet(wb, assumptionsWs, "Assumptions");
  for (const { name, ws } of itemSheets) {
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
