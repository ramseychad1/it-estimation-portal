import { AlertTriangle, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { Drawer } from "./Drawer";
import { ConfirmModal } from "./ConfirmModal";
import { InfoModal } from "./InfoModal";
import { ValueBlock } from "./ValueBlock";
import { PrimaryButton, SecondaryButton } from "./buttons";
import { useToast } from "./Toast";
import { ApiError } from "../lib/api";
import { saveSubFeatureTemplate } from "../lib/api/templates";
import {
  parseCatalogWorkbook,
  diffAgainstLive,
  type CatalogDiff,
  type DiffedItem,
} from "../lib/catalogImport";

interface CatalogImportDrawerProps {
  open: boolean;
  onClose: () => void;
}

const MAX_MB = 20;

type Stage = "upload" | "diffing" | "review" | "nothing-to-import";

interface ApplyResult {
  subFeatureId: number;
  containerName: string;
  subFeatureName: string;
  ok: boolean;
  message?: string;
}

function fmtHours(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === "object" && "message" in body) {
      return String((body as { message: unknown }).message);
    }
    return `Request failed (${err.status}).`;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/**
 * Upload → diff → review → apply flow for reimporting hour edits made in a
 * downloaded catalog export. Structure (sheet layout, phase columns) is
 * assumed unmodified — this parses its own export format, not an arbitrary
 * spreadsheet. Applying reuses `saveSubFeatureTemplate`, the same endpoint
 * the template editor's Save button calls, so versioning/audit/validation
 * all go through the normal path.
 */
export function CatalogImportDrawer({ open, onClose }: CatalogImportDrawerProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [parseError, setParseError] = useState<string | null>(null);
  const [diff, setDiff] = useState<CatalogDiff | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const [results, setResults] = useState<ApplyResult[] | null>(null);

  function reset() {
    setStage("upload");
    setParseError(null);
    setDiff(null);
    setExpanded(new Set());
    setConfirmOpen(false);
    setApplying(false);
    setApplyProgress(0);
    setResults(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    if (picked.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds the ${MAX_MB} MB limit.`);
      return;
    }

    setStage("diffing");
    setParseError(null);
    try {
      const parsed = await parseCatalogWorkbook(picked);
      const d = await diffAgainstLive(parsed);
      setDiff(d);
      setStage(d.changedCount > 0 ? "review" : "nothing-to-import");
    } catch (err) {
      setParseError(errorMessage(err));
      setStage("upload");
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApply() {
    if (!diff) return;
    const toApply = diff.items.filter((i) => i.status === "changed");
    setApplying(true);
    setApplyProgress(0);
    const out: ApplyResult[] = [];
    for (const item of toApply) {
      try {
        await saveSubFeatureTemplate(item.subFeatureId, {
          lines: item.lines,
          changeReason: "Bulk reimport from catalog export",
        });
        out.push({
          subFeatureId: item.subFeatureId, containerName: item.containerName,
          subFeatureName: item.subFeatureName, ok: true,
        });
      } catch (err) {
        out.push({
          subFeatureId: item.subFeatureId, containerName: item.containerName,
          subFeatureName: item.subFeatureName, ok: false, message: errorMessage(err),
        });
      }
      setApplyProgress((n) => n + 1);
    }
    setApplying(false);
    setResults(out);
    setConfirmOpen(false);
    const failCount = out.filter((r) => !r.ok).length;
    if (failCount === 0) {
      toast.success(`Applied ${out.length} template ${out.length === 1 ? "change" : "changes"}.`);
    } else {
      toast.error(`${out.length - failCount} applied, ${failCount} failed — see details below.`);
    }
  }

  const changed = diff?.items.filter((i) => i.status === "changed") ?? [];
  const missing = diff?.items.filter((i) => i.status === "missing") ?? [];
  const invalid = diff?.items.filter((i) => i.status === "invalid") ?? [];

  return (
    <>
      <Drawer
        open={open}
        onClose={handleClose}
        title="Import Catalog"
        subtitle="Upload an edited catalog export to review and apply hour changes."
        width={720}
        footer={
          stage === "review" && !results ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
                {changed.length} {changed.length === 1 ? "template" : "templates"} will be updated
              </span>
              <div className="flex items-center gap-2">
                <SecondaryButton onClick={handleClose}>Cancel</SecondaryButton>
                <PrimaryButton onClick={() => setConfirmOpen(true)} disabled={changed.length === 0}>
                  Apply {changed.length} {changed.length === 1 ? "Change" : "Changes"}
                </PrimaryButton>
              </div>
            </div>
          ) : results ? (
            <div className="flex justify-end w-full">
              <PrimaryButton onClick={handleClose}>Done</PrimaryButton>
            </div>
          ) : undefined
        }
      >
        {stage === "upload" && (
          <div>
            {parseError && (
              <div
                className="flex items-start gap-2 rounded-md mb-4"
                style={{ padding: "10px 12px", background: "var(--color-danger-soft)", fontSize: 13 }}
              >
                <AlertTriangle className="text-cardinal-red flex-shrink-0 mt-0.5" style={{ width: 15, height: 15 }} strokeWidth={1.5} />
                <span className="text-near-black">{parseError}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-md border border-dashed border-warm-gray-med px-6 py-10 text-warm-gray-med hover:border-near-black hover:text-near-black w-full"
              style={{ fontSize: 13 }}
            >
              <UploadCloud style={{ width: 24, height: 24 }} strokeWidth={1.5} />
              <span>Choose a catalog export file (.xlsx, max {MAX_MB} MB)</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => void handleFileChange(e)}
              tabIndex={-1}
              aria-hidden
            />
          </div>
        )}

        {stage === "diffing" && (
          <p className="text-warm-gray-med" style={{ fontSize: 13 }}>Reading file and comparing against the current catalog…</p>
        )}

        {stage === "review" && diff && !results && (
          <div>
            <p className="text-warm-gray-med mb-4" style={{ fontSize: 12 }}>
              {diff.changedCount} changed · {diff.unchangedCount} unchanged
              {diff.missingCount > 0 && ` · ${diff.missingCount} skipped`}
              {diff.invalidCount > 0 && ` · ${diff.invalidCount} invalid`}
            </p>

            {invalid.length > 0 && <InvalidList items={invalid} />}
            {missing.length > 0 && <MissingList items={missing} />}

            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {changed.map((item) => (
                <li key={item.subFeatureId} className="rounded-md border border-warm-gray-light">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.subFeatureId)}
                    className="flex items-center justify-between w-full text-left bg-transparent border-0 cursor-pointer"
                    style={{ padding: "10px 12px" }}
                  >
                    <span className="text-near-black" style={{ fontSize: 13 }}>
                      {item.containerName} › {item.subFeatureName}
                    </span>
                    <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
                      {item.cellDiffs.length} {item.cellDiffs.length === 1 ? "cell" : "cells"} changed
                    </span>
                  </button>
                  {expanded.has(item.subFeatureId) && (
                    <ul
                      className="m-0 list-none flex flex-col gap-2"
                      style={{ padding: "0 12px 12px" }}
                    >
                      {item.cellDiffs.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2" style={{ fontSize: 12 }}>
                          <span
                            className="text-warm-gray-med"
                            style={{ width: 160, flexShrink: 0, paddingTop: 6, fontSize: 11 }}
                          >
                            {c.phaseName} — {fieldLabel(c.field)}
                          </span>
                          <ValueBlock value={fmtHours(c.oldValue)} variant="before" />
                          <span className="text-warm-gray-med self-center">→</span>
                          <ValueBlock value={fmtHours(c.newValue)} variant="after" />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {results && <ResultsList results={results} />}
      </Drawer>

      <ConfirmModal
        open={confirmOpen}
        title="Apply catalog changes?"
        body={`This will save a new template version for ${changed.length} sub-feature${changed.length === 1 ? "" : "s"}. This can't be undone (though each save is a new version — prior versions stay in history).`}
        confirmLabel={applying ? `Applying ${applyProgress}/${changed.length}…` : "Apply"}
        requireTypedConfirmation={{ value: "IMPORT", label: 'Type "IMPORT" to confirm' }}
        onCancel={() => !applying && setConfirmOpen(false)}
        onConfirm={handleApply}
      />

      <InfoModal
        open={stage === "nothing-to-import"}
        title="Nothing to import"
        body="This file matches the current catalog — no hour values have changed."
        onClose={handleClose}
      />
    </>
  );
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    onshoreLow: "Onshore Low", onshoreMed: "Onshore Med", onshoreHigh: "Onshore High",
    offshoreLow: "Offshore Low", offshoreMed: "Offshore Med", offshoreHigh: "Offshore High",
  };
  return labels[field] ?? field;
}

function InvalidList({ items }: { items: DiffedItem[] }) {
  return (
    <div
      className="rounded-md mb-3"
      style={{ padding: "10px 12px", background: "var(--color-danger-soft)", fontSize: 12 }}
    >
      <p className="font-medium text-near-black mb-1">
        {items.length} {items.length === 1 ? "sub-feature has" : "sub-features have"} out-of-range values — excluded from apply:
      </p>
      <ul className="m-0 pl-4">
        {items.map((item) => (
          <li key={item.subFeatureId} className="text-near-black">
            {item.containerName} › {item.subFeatureName}: {item.invalidReasons.join("; ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MissingList({ items }: { items: DiffedItem[] }) {
  return (
    <div
      className="rounded-md mb-3"
      style={{ padding: "10px 12px", background: "var(--color-warm-gray-light)", fontSize: 12 }}
    >
      <p className="font-medium text-near-black mb-1">
        {items.length} {items.length === 1 ? "sub-feature" : "sub-features"} no longer exist and will be skipped:
      </p>
      <ul className="m-0 pl-4">
        {items.map((item) => (
          <li key={item.subFeatureId} className="text-near-black">
            {item.containerName} › {item.subFeatureName}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultsList({ results }: { results: ApplyResult[] }) {
  const failed = results.filter((r) => !r.ok);
  const succeeded = results.filter((r) => r.ok);
  return (
    <div>
      <p className="text-near-black mb-3" style={{ fontSize: 13 }}>
        {succeeded.length} applied{failed.length > 0 ? `, ${failed.length} failed` : ""}.
      </p>
      {failed.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {failed.map((r) => (
            <li
              key={r.subFeatureId}
              className="rounded-md"
              style={{ padding: "8px 12px", background: "var(--color-danger-soft)", fontSize: 12 }}
            >
              <span className="font-medium text-near-black">{r.containerName} › {r.subFeatureName}</span>
              <div className="text-near-black mt-0.5">{r.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
