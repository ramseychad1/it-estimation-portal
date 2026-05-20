import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Complexity } from "../lib/api/estimates";
import type { EstimateRequestDetail, EstimateRequestItemDto } from "../lib/api/estimates";
import { computeClientPrice, displayedRow, onshoreHoursForLines, offshoreHoursForLines, pricingModelLabel } from "../lib/estimateMath";

// ── Design tokens ────────────────────────────────────────────────────────────

const C = {
  nearBlack: "#27251F",
  white:     "#FFFFFF",
  redAccent: "#E41F35",
  grayMed:   "#948A85",
  grayLight: "#EFEFEF",
  border:    "#E5E5E2",
  borderStr: "#D8D6D2",
  lightBlue: "#BBDDE6",
  navy:      "#1C2B4A",
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.nearBlack,
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 0,
    backgroundColor: C.white,
  },

  // ── Header band ──
  headerBand: {
    backgroundColor: C.navy,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 14,
    marginBottom: 0,
  },
  headerWordmark: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.8,
    color: C.lightBlue,
    textTransform: "uppercase",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 8,
    color: C.lightBlue,
    marginTop: 2,
  },

  // ── Body container ──
  body: {
    paddingHorizontal: 40,
    paddingTop: 20,
  },

  // ── Metadata block ──
  metaBlock: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderStr,
    borderBottomStyle: "solid",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  metaCell: {
    marginRight: 28,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 6.5,
    color: C.grayMed,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 2,
    fontFamily: "Helvetica-Bold",
  },
  metaValue: {
    fontSize: 9,
    color: C.nearBlack,
  },
  metaValueBold: {
    fontSize: 9,
    color: C.nearBlack,
    fontFamily: "Helvetica-Bold",
  },
  approvedBadge: {
    backgroundColor: "#D1F0DC",
    color: "#1A5C35",
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  descriptionBlock: {
    marginTop: 6,
  },

  // ── Section divider ──
  sectionDivider: {
    marginTop: 4,
    marginBottom: 16,
    borderTopWidth: 2,
    borderTopColor: C.nearBlack,
    borderTopStyle: "solid",
  },

  // ── Item section ──
  itemSection: {
    marginBottom: 20,
  },
  itemHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0F4F8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: C.navy,
    borderLeftStyle: "solid",
    marginBottom: 0,
  },
  itemNumber: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.grayMed,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.nearBlack,
    flex: 1,
  },
  complexityBadge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    backgroundColor: C.lightBlue,
    color: C.navy,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },

  // ── Phase table ──
  tableContainer: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "solid",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.nearBlack,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: "solid",
  },
  tableRowAlt: {
    backgroundColor: "#FAFAF9",
  },
  tableFooterRow: {
    flexDirection: "row",
    backgroundColor: C.grayLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderTopWidth: 2,
    borderTopColor: C.borderStr,
    borderTopStyle: "solid",
  },
  thPhase: {
    flex: 2.2,
    fontSize: 7,
    color: C.lightBlue,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  thNum: {
    flex: 1,
    fontSize: 7,
    color: C.lightBlue,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "right",
  },
  tdPhase: {
    flex: 2.2,
    fontSize: 8,
    color: C.nearBlack,
  },
  tdNum: {
    flex: 1,
    fontSize: 8,
    color: C.nearBlack,
    textAlign: "right",
  },
  tdNumBold: {
    flex: 1,
    fontSize: 8,
    color: C.nearBlack,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  tdPhaseBold: {
    flex: 2.2,
    fontSize: 8,
    color: C.nearBlack,
    fontFamily: "Helvetica-Bold",
  },
  overrideStar: {
    fontSize: 6,
    color: C.redAccent,
  },

  // ── Rates line ──
  ratesLine: {
    fontSize: 7,
    color: C.grayMed,
    marginTop: 4,
    marginBottom: 4,
  },

  // ── Reviewer block ──
  reviewerBlock: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F8FAFB",
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "solid",
  },
  reviewerRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  reviewerLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.grayMed,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    width: 80,
  },
  reviewerValue: {
    fontSize: 8,
    color: C.nearBlack,
    flex: 1,
  },
  justificationText: {
    fontSize: 8,
    color: C.nearBlack,
    fontFamily: "Helvetica-Oblique",
    paddingLeft: 10,
    paddingVertical: 4,
    borderLeftWidth: 2,
    borderLeftColor: C.lightBlue,
    borderLeftStyle: "solid",
    marginTop: 2,
  },

  // ── Q&A block ──
  qaBlock: {
    marginTop: 10,
  },
  qaSectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.grayMed,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: "solid",
  },
  qaItem: {
    marginBottom: 7,
  },
  questionText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.nearBlack,
    marginBottom: 2,
  },
  answerText: {
    fontSize: 8,
    color: C.nearBlack,
    paddingLeft: 12,
  },
  answerBlank: {
    fontSize: 8,
    color: C.grayMed,
    fontFamily: "Helvetica-Oblique",
    paddingLeft: 12,
  },
  fileEntry: {
    fontSize: 7,
    color: C.grayMed,
    paddingLeft: 12,
    marginTop: 2,
  },

  // ── Project summary ──
  summarySection: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: C.nearBlack,
    borderTopStyle: "solid",
  },
  summaryTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.nearBlack,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  summaryTableContainer: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "solid",
  },
  summaryHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.nearBlack,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: "solid",
  },
  summaryFooter: {
    flexDirection: "row",
    backgroundColor: C.grayLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderTopWidth: 2,
    borderTopColor: C.borderStr,
    borderTopStyle: "solid",
  },
  thProduct: {
    flex: 3,
    fontSize: 7,
    color: C.lightBlue,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  thCmplx: {
    width: 44,
    fontSize: 7,
    color: C.lightBlue,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  thSumNum: {
    flex: 1,
    fontSize: 7,
    color: C.lightBlue,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "right",
  },
  tdProduct: {
    flex: 3,
    fontSize: 8,
    color: C.nearBlack,
  },
  tdCmplx: {
    width: 44,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    backgroundColor: C.lightBlue,
    textAlign: "center",
    borderRadius: 2,
    paddingVertical: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tdSumNum: {
    flex: 1,
    fontSize: 8,
    color: C.nearBlack,
    textAlign: "right",
  },
  tdSumNumBold: {
    flex: 1,
    fontSize: 8,
    color: C.nearBlack,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  tdProductBold: {
    flex: 3,
    fontSize: 8,
    color: C.nearBlack,
    fontFamily: "Helvetica-Bold",
  },
  totalCostText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.nearBlack,
  },

  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: C.grayMed,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtNum(n: number): string {
  return Math.ceil(n).toLocaleString("en-US");
}

function fmtMoney(n: number): string {
  return "$" + Math.ceil(n).toLocaleString("en-US");
}

function complexityLabel(c: Complexity): string {
  return c === "LOW" ? "Low" : c === "MED" ? "Medium" : "High";
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RateShape = {
  onshoreRate: string;
  offshoreRate: string;
  effectiveDate: string;
} | null;

// ── Sub-components ────────────────────────────────────────────────────────────

function ItemSection({
  item,
  index,
  rate,
}: {
  item: EstimateRequestItemDto;
  index: number;
  rate: RateShape;
}) {
  const complexity = item.complexity!;
  const title = item.subFeatureName
    ? `${item.productName}  ›  ${item.subFeatureName}`
    : item.productName;

  const onsRate = rate ? Number(rate.onshoreRate) : 0;
  const offsRate = rate ? Number(rate.offshoreRate) : 0;

  const rows = item.phaseLines.map((line) => {
    const d = displayedRow(line, complexity);
    const hrs = Math.ceil(d.onshore + d.offshore);
    const cost = Math.ceil(d.onshore * onsRate + d.offshore * offsRate);
    return { line, d, hrs, cost };
  });

  const totalOns = rows.reduce((s, r) => s + r.d.onshore, 0);
  const totalOff = rows.reduce((s, r) => s + r.d.offshore, 0);
  const totalHrs = Math.ceil(totalOns + totalOff);
  const totalCost = Math.ceil(totalOns * onsRate + totalOff * offsRate);

  const hasReviewerInfo = !!(item.reviewerName || item.justification);
  const hasAnswers = item.answers.some((a) => a.answerText || a.attachments.length > 0);

  return (
    <View style={s.itemSection}>
      {/* Heading */}
      <View style={s.itemHeading}>
        <Text style={s.itemNumber}>Item {index}</Text>
        <Text style={s.itemTitle}>{title}</Text>
        <Text style={s.complexityBadge}>{complexityLabel(complexity)}</Text>
      </View>

      {/* Phase table */}
      <View style={s.tableContainer}>
        <View style={s.tableHeaderRow}>
          <Text style={s.thPhase}>SDLC Phase</Text>
          <Text style={s.thNum}>Onshore Hrs</Text>
          <Text style={s.thNum}>Offshore Hrs</Text>
          <Text style={s.thNum}>Total Hrs</Text>
          {rate && <Text style={s.thNum}>Phase Cost</Text>}
        </View>

        {rows.map(({ line, d, hrs, cost }, i) => (
          <View
            key={line.sdlcPhaseId}
            style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
          >
            <Text style={s.tdPhase}>{line.sdlcPhaseName}</Text>
            <Text style={s.tdNum}>
              {fmtNum(d.onshore)}
              {d.onshoreOverridden ? <Text style={s.overrideStar}> *</Text> : ""}
            </Text>
            <Text style={s.tdNum}>
              {fmtNum(d.offshore)}
              {d.offshoreOverridden ? <Text style={s.overrideStar}> *</Text> : ""}
            </Text>
            <Text style={s.tdNum}>{fmtNum(hrs)}</Text>
            {rate && <Text style={s.tdNum}>{fmtMoney(cost)}</Text>}
          </View>
        ))}

        {/* Total row */}
        <View style={s.tableFooterRow}>
          <Text style={s.tdPhaseBold}>Item Total</Text>
          <Text style={s.tdNumBold}>{fmtNum(totalOns)}</Text>
          <Text style={s.tdNumBold}>{fmtNum(totalOff)}</Text>
          <Text style={s.tdNumBold}>{fmtNum(totalHrs)}</Text>
          {rate && <Text style={s.tdNumBold}>{fmtMoney(totalCost)}</Text>}
        </View>
      </View>

      {/* Override note */}
      {rows.some((r) => r.d.onshoreOverridden || r.d.offshoreOverridden) && (
        <Text style={[s.ratesLine, { marginTop: 3 }]}>
          * Value adjusted by reviewer from template snapshot.
        </Text>
      )}

      {/* Rates */}
      {rate && (
        <Text style={s.ratesLine}>
          Rates applied: Onshore ${rate.onshoreRate}/hr · Offshore ${rate.offshoreRate}/hr (effective {rate.effectiveDate})
        </Text>
      )}

      {/* Client Price */}
      {(() => {
        const clientPrice = computeClientPrice(
          item.pricingModel,
          rate ? totalCost : null,
          totalHrs,
          item.tmMultiplier, item.tmTargetMarginPct,
          item.matBillableRate, item.matDiscountPct,
        );
        if (clientPrice == null) return null;
        return (
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 6, gap: 6 }}>
            <Text style={[s.ratesLine, { margin: 0 }]}>
              Client Price ({pricingModelLabel(item.pricingModel)}):
            </Text>
            <Text style={[s.ratesLine, { margin: 0, fontFamily: "Helvetica-Bold", color: C.navy }]}>
              ${fmtMoney(Math.ceil(clientPrice))}
            </Text>
          </View>
        );
      })()}

      {/* Reviewer & justification */}
      {hasReviewerInfo && (
        <View style={s.reviewerBlock}>
          {item.reviewerName && (
            <View style={s.reviewerRow}>
              <Text style={s.reviewerLabel}>Reviewed by</Text>
              <Text style={s.reviewerValue}>
                {item.reviewerName}
                {item.reviewedAt ? `  ·  ${fmtDate(item.reviewedAt)}` : ""}
              </Text>
            </View>
          )}
          {item.justification && (
            <View>
              <Text style={[s.reviewerLabel, { marginBottom: 4 }]}>Reviewer's Notes</Text>
              <Text style={s.justificationText}>{item.justification}</Text>
            </View>
          )}
        </View>
      )}

      {/* Q&A */}
      {hasAnswers && (
        <View style={s.qaBlock}>
          <Text style={s.qaSectionLabel}>Questions &amp; Answers</Text>
          {item.answers.map((a) => (
            <View key={a.questionId} style={s.qaItem}>
              <Text style={s.questionText}>{a.questionText}</Text>
              {a.answerText ? (
                <Text style={s.answerText}>{a.answerText}</Text>
              ) : (
                <Text style={s.answerBlank}>No answer provided</Text>
              )}
              {a.attachments.map((att) => (
                <Text key={att.id} style={s.fileEntry}>
                  [file]  {att.originalFilename}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Clarification exchange */}
      {item.clarificationNote && (
        <View style={s.qaBlock}>
          <Text style={s.qaSectionLabel}>Clarification Exchange</Text>
          <View style={s.qaItem}>
            <Text style={s.questionText}>Reviewer's Question</Text>
            <Text style={s.justificationText}>{item.clarificationNote}</Text>
          </View>
          {item.clarificationResponse && (
            <View style={s.qaItem}>
              <Text style={s.questionText}>Requester's Response</Text>
              <Text style={s.answerText}>{item.clarificationResponse}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function ProjectSummary({
  items,
  rate,
}: {
  items: EstimateRequestItemDto[];
  rate: RateShape;
}) {
  const onsRate = rate ? Number(rate.onshoreRate) : 0;
  const offsRate = rate ? Number(rate.offshoreRate) : 0;

  const rows = items.map((it) => {
    const ons = onshoreHoursForLines(it.phaseLines, it.complexity);
    const off = offshoreHoursForLines(it.phaseLines, it.complexity);
    const total = Math.ceil(ons + off);
    const cost = Math.ceil(ons * onsRate + off * offsRate);
    const clientPrice = computeClientPrice(
      it.pricingModel,
      rate ? cost : null,
      total,
      it.tmMultiplier, it.tmTargetMarginPct,
      it.matBillableRate, it.matDiscountPct,
    );
    return { it, ons, off, total, cost, clientPrice };
  });

  const grandOns = rows.reduce((s, r) => s + r.ons, 0);
  const grandOff = rows.reduce((s, r) => s + r.off, 0);
  const grandTotal = Math.ceil(grandOns + grandOff);
  const grandCost = Math.ceil(grandOns * onsRate + grandOff * offsRate);
  const hasClientPrice = rows.some((r) => r.clientPrice != null);
  const grandClientPrice = hasClientPrice
    ? Math.ceil(rows.reduce((s, r) => s + (r.clientPrice ?? 0), 0))
    : null;

  return (
    <View style={s.summarySection}>
      <Text style={s.summaryTitle}>Project Summary</Text>

      <View style={s.summaryTableContainer}>
        <View style={s.summaryHeaderRow}>
          <Text style={s.thProduct}>Product / Sub-feature</Text>
          <Text style={s.thCmplx}>Cmplx</Text>
          <Text style={s.thSumNum}>Onshore Hrs</Text>
          <Text style={s.thSumNum}>Offshore Hrs</Text>
          <Text style={s.thSumNum}>Total Hrs</Text>
          {rate && <Text style={s.thSumNum}>Int. Cost</Text>}
          {hasClientPrice && <Text style={s.thSumNum}>Client Price</Text>}
        </View>

        {rows.map(({ it, ons, off, total, cost, clientPrice }) => {
          const label = it.subFeatureName
            ? `${it.productName} · ${it.subFeatureName}`
            : it.productName;
          return (
            <View key={it.id} style={s.summaryRow}>
              <Text style={s.tdProduct}>{label}</Text>
              <Text style={s.tdCmplx}>{it.complexity ?? "—"}</Text>
              <Text style={s.tdSumNum}>{fmtNum(ons)}</Text>
              <Text style={s.tdSumNum}>{fmtNum(off)}</Text>
              <Text style={s.tdSumNum}>{fmtNum(total)}</Text>
              {rate && <Text style={s.tdSumNum}>{fmtMoney(cost)}</Text>}
              {hasClientPrice && (
                <Text style={s.tdSumNum}>
                  {clientPrice != null ? fmtMoney(Math.ceil(clientPrice)) : "—"}
                </Text>
              )}
            </View>
          );
        })}

        <View style={s.summaryFooter}>
          <Text style={s.tdProductBold}>Grand Total</Text>
          <Text style={{ width: 44 }} />
          <Text style={s.tdSumNumBold}>{fmtNum(grandOns)}</Text>
          <Text style={s.tdSumNumBold}>{fmtNum(grandOff)}</Text>
          <Text style={s.tdSumNumBold}>{fmtNum(grandTotal)}</Text>
          {rate && (
            <Text style={[s.tdSumNumBold, { color: C.navy }]}>{fmtMoney(grandCost)}</Text>
          )}
          {hasClientPrice && (
            <Text style={[s.tdSumNumBold, { color: C.navy }]}>
              {grandClientPrice != null ? fmtMoney(grandClientPrice) : "—"}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Shared page chrome ────────────────────────────────────────────────────────

function PageHeader({ requestId }: { requestId: number }) {
  return (
    <View style={s.headerBand}>
      <Text style={s.headerWordmark}>IT Estimation Portal</Text>
      <View style={s.headerRight}>
        <Text style={s.headerTitle}>ESTIMATE REPORT</Text>
        <Text style={s.headerSubtitle}>Request #{requestId}</Text>
      </View>
    </View>
  );
}

function PageFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>IT Estimation Portal  ·  Confidential  ·  Internal Use Only</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) =>
          `Generated ${fmtDate(generatedAt)}  ·  Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

// ── Main document ─────────────────────────────────────────────────────────────

export interface EstimatePdfProps {
  detail: EstimateRequestDetail;
  currentRate: RateShape;
  /** ISO timestamp used in the footer */
  generatedAt: string;
  requesterName?: string;
}

export function EstimatePdfDocument({
  detail,
  currentRate,
  generatedAt,
  requesterName,
}: EstimatePdfProps) {
  const approvedItems = detail.items.filter(
    (it) => it.status === "APPROVED" && it.complexity != null,
  );

  // Earliest submission and latest approval across all items
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

  return (
    <Document
      title={`Estimate Report — ${detail.title}`}
      author="IT Estimation Portal"
      creator="IT Estimation Portal"
    >
      {/* ── Page 1: Cover / Project Summary ── */}
      <Page size="LETTER" style={s.page}>
        <PageHeader requestId={detail.id} />

        <View style={s.body}>
          {/* Metadata */}
          <View style={s.metaBlock}>
            <View style={[s.metaGrid, { marginBottom: 10 }]}>
              <View style={s.metaCell}>
                <Text style={s.metaLabel}>Status</Text>
                <Text style={s.approvedBadge}>APPROVED</Text>
              </View>
              <View style={[s.metaCell, { flex: 1 }]}>
                <Text style={s.metaLabel}>Title</Text>
                <Text style={s.metaValueBold}>{detail.title}</Text>
              </View>
            </View>

            <View style={s.metaGrid}>
              {requesterName && (
                <View style={s.metaCell}>
                  <Text style={s.metaLabel}>Requested by</Text>
                  <Text style={s.metaValue}>{requesterName}</Text>
                </View>
              )}
              <View style={s.metaCell}>
                <Text style={s.metaLabel}>Go-Live Target</Text>
                <Text style={s.metaValue}>
                  {detail.goLiveDate
                    ? fmtDate(detail.goLiveDate + "T00:00:00")
                    : "Unknown"}
                </Text>
              </View>
              {submittedAt && (
                <View style={s.metaCell}>
                  <Text style={s.metaLabel}>Submitted</Text>
                  <Text style={s.metaValue}>{fmtDate(submittedAt)}</Text>
                </View>
              )}
              {approvedAt && (
                <View style={s.metaCell}>
                  <Text style={s.metaLabel}>Approved</Text>
                  <Text style={s.metaValue}>{fmtDate(approvedAt)}</Text>
                </View>
              )}
              <View style={s.metaCell}>
                <Text style={s.metaLabel}>Products</Text>
                <Text style={s.metaValue}>{approvedItems.length}</Text>
              </View>
            </View>

            {detail.description && (
              <View style={s.descriptionBlock}>
                <Text style={s.metaLabel}>Description</Text>
                <Text style={[s.metaValue, { marginTop: 2 }]}>{detail.description}</Text>
              </View>
            )}
          </View>

          {/* Project Summary always on page 1 */}
          <ProjectSummary items={approvedItems} rate={currentRate} />
        </View>

        <PageFooter generatedAt={generatedAt} />
      </Page>

      {/* ── One page per approved item ── */}
      {approvedItems.map((item, idx) => (
        <Page key={item.id} size="LETTER" style={s.page}>
          <PageHeader requestId={detail.id} />

          <View style={s.body}>
            <ItemSection
              item={item}
              index={idx + 1}
              rate={currentRate}
            />
          </View>

          <PageFooter generatedAt={generatedAt} />
        </Page>
      ))}
    </Document>
  );
}
