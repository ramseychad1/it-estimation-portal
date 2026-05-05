import { Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../lib/api";
import {
  applyPasteAt,
  HoursGrid,
} from "../../../components/hours/HoursGrid";
import {
  COLUMNS,
  EMPTY_ROW,
  type RowKey,
  type RowValues,
} from "../../../components/hours/columns";
import type { PhaseMeta } from "../../../components/hours/HoursRow";
import { EmptyState } from "../../../components/EmptyState";
import { PrimaryButton, TertiaryButton } from "../../../components/buttons";
import { TextInput } from "../../../components/inputs";
import { UserCell } from "../../../components/UserCell";
import { useToast } from "../../../components/Toast";
import { useUnsavedChangesGuard } from "../../../lib/useUnsavedChangesGuard";
import { useRatesPageQuery } from "../../../lib/queries/rates";
import type {
  SaveTemplateLineInput,
  SaveTemplateVersionRequest,
  TemplateLineView,
  TemplateView,
} from "../../../lib/api/templates";

interface TemplateEditorCardProps {
  template: TemplateView | null;
  loading: boolean;
  onCreate: () => Promise<void>;
  onSave: (req: SaveTemplateVersionRequest) => Promise<TemplateView>;
  /** Render label for the empty-state CTA — "atomic product" or "sub-feature". */
  parentNoun: string;
  /** When false the editor renders read-only; create/save/discard are hidden. Defaults to true. */
  canManage?: boolean;
}

/**
 * The template card that lives inline on a Product detail (atomic only)
 * or Sub-feature detail page. Replaces the Phase 5a "coming with Phase
 * 5b" placeholder.
 *
 * <p>Owns the local editing state: pulls the server's lines into a
 * {@code Map<phaseId, RowValues>}, lets the grid mutate it, computes
 * dirty by comparing to the original snapshot, hands the snapshot back
 * to the server on save. "Discard changes" reverts to the snapshot in
 * one render.
 *
 * <p>Per-cell server validation errors are mapped back via the optional
 * {@code error.fieldErrors} map keyed by {@code "phase{id}.{cellKey}"}
 * — the standard ErrorResponse channel. If the server's validation tree
 * deepens later, the parsing is colocated here in {@link
 * #applyServerErrors} for easy extension.
 */
export function TemplateEditorCard({
  template,
  loading,
  onCreate,
  onSave,
  parentNoun,
  canManage = true,
}: TemplateEditorCardProps) {
  const toast = useToast();
  const ratesQuery = useRatesPageQuery({ size: 1 });
  const currentRate = ratesQuery.data?.current;
  const onshoreRate = currentRate ? parseFloat(currentRate.onshoreRate) : undefined;
  const offshoreRate = currentRate ? parseFloat(currentRate.offshoreRate) : undefined;

  // Snapshot comes from the server response; local edit state is a
  // separate map so "Discard" is a simple snapshot restore.
  const original = useMemo(() => buildValuesMap(template?.lines ?? []), [template]);
  const phases = useMemo(() => buildPhaseList(template?.lines ?? []), [template]);

  const [values, setValues] = useState<Map<number, RowValues>>(original);
  const [errors, setErrors] = useState<Map<number, Partial<Record<RowKey, string>>>>(new Map());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset local state whenever the server pushes a new template (Day 1
  // create, save success, refetch).
  useEffect(() => {
    setValues(original);
    setErrors(new Map());
    setReason("");
  }, [template?.id, original]);

  const isDirty = useMemo(() => {
    if (!template) return false;
    if (values.size !== original.size) return true;
    for (const [phaseId, rowValues] of values) {
      const orig = original.get(phaseId);
      if (!orig) return true;
      for (const col of COLUMNS) {
        if (rowValues[col.key] !== orig[col.key]) return true;
      }
    }
    return false;
  }, [values, original, template]);

  useUnsavedChangesGuard(isDirty);

  // ---- empty state (Day 1) ---------------------------------------------

  if (!loading && template == null) {
    return (
      <EmptyState
        icon={Layers}
        title="No template yet"
        description={`Create the estimate template for this ${parentNoun} to enable estimate requests.`}
        action={
          canManage ? (
            <PrimaryButton
              onClick={async () => {
                setCreating(true);
                try {
                  await onCreate();
                  toast.success("Template created.");
                } catch {
                  toast.error("Could not create the template.");
                } finally {
                  setCreating(false);
                }
              }}
              disabled={creating}
            >
              {creating ? "Creating…" : "+ Create template"}
            </PrimaryButton>
          ) : undefined
        }
      />
    );
  }

  if (loading || !template) {
    return <p className="text-warm-gray-med text-center py-8">Loading…</p>;
  }

  function discardChanges() {
    setValues(original);
    setErrors(new Map());
    setReason("");
  }

  async function handleSave() {
    if (!template) return;
    // Client-side validation: every cell ≥ 0 and finite. Server re-checks.
    const clientErrors = validateClient(values);
    if (clientErrors.size > 0) {
      setErrors(clientErrors);
      toast.error("Some cells need attention before saving.");
      return;
    }

    const lines: SaveTemplateLineInput[] = Array.from(values.entries()).map(
      ([phaseId, v]) => ({
        sdlcPhaseId: phaseId,
        onshoreLow: v.onshoreLow,
        onshoreMed: v.onshoreMed,
        onshoreHigh: v.onshoreHigh,
        offshoreLow: v.offshoreLow,
        offshoreMed: v.offshoreMed,
        offshoreHigh: v.offshoreHigh,
      }),
    );

    setSaving(true);
    try {
      const next = await onSave({ lines, changeReason: reason.trim() || null });
      toast.success(`Saved version ${next.versionNumber}.`);
      setErrors(new Map());
      setReason("");
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = applyServerErrors(err);
        if (mapped.size > 0) setErrors(mapped);
        toast.error(
          err.body && typeof err.body === "object" && "message" in err.body
            ? String((err.body as { message: unknown }).message)
            : "Could not save the template.",
        );
      } else {
        toast.error("Could not save the template.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header strip with version pill + save/discard actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <VersionPill versionNumber={template.versionNumber} />
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <TertiaryButton
                onClick={discardChanges}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Discard changes
              </TertiaryButton>
            )}
            <PrimaryButton
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* The grid itself */}
      <HoursGrid
        phases={phases}
        values={values}
        errors={errors}
        onshoreRate={onshoreRate}
        offshoreRate={offshoreRate}
        onChange={(phaseId, key, next) => {
          setValues((prev) => {
            const out = new Map(prev);
            const row = { ...(out.get(phaseId) ?? EMPTY_ROW), [key]: next };
            out.set(phaseId, row);
            return out;
          });
          // Clear any per-cell error on edit.
          setErrors((prev) => {
            const phaseErrors = prev.get(phaseId);
            if (!phaseErrors || !phaseErrors[key]) return prev;
            const out = new Map(prev);
            const updated = { ...phaseErrors };
            delete updated[key];
            if (Object.keys(updated).length === 0) out.delete(phaseId);
            else out.set(phaseId, updated);
            return out;
          });
        }}
        onPaste={(anchor, rows) => {
          setValues((prev) => applyPasteAt(anchor, rows, phases, prev));
        }}
        disabled={saving || !canManage}
      />

      {/* Card footer: last-saved meta + change-reason input when dirty */}
      <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
        <div
          className="inline-flex items-center gap-2 text-warm-gray-med"
          style={{ fontSize: 12 }}
        >
          <span>Last saved by</span>
          <UserCell userId={template.createdBy} size={18} />
          {template.createdAt && <span>· {formatTimestamp(template.createdAt)}</span>}
        </div>
        {isDirty && (
          <div className="flex items-center gap-2" style={{ minWidth: 320, maxWidth: 420 }}>
            <TextInput
              label="Reason for change (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Updated build hours after the new framework rollout."
              disabled={saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---- helpers -------------------------------------------------------------

function buildValuesMap(lines: TemplateLineView[]): Map<number, RowValues> {
  const out = new Map<number, RowValues>();
  for (const l of lines) {
    out.set(l.sdlcPhaseId, {
      onshoreLow: l.onshoreLow,
      onshoreMed: l.onshoreMed,
      onshoreHigh: l.onshoreHigh,
      offshoreLow: l.offshoreLow,
      offshoreMed: l.offshoreMed,
      offshoreHigh: l.offshoreHigh,
    });
  }
  return out;
}

function buildPhaseList(lines: TemplateLineView[]): PhaseMeta[] {
  return lines
    .map((l) => ({
      id: l.sdlcPhaseId,
      name: l.sdlcPhaseName,
      displayOrder: l.sdlcPhaseDisplayOrder,
      active: l.sdlcPhaseActive,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function validateClient(
  values: Map<number, RowValues>,
): Map<number, Partial<Record<RowKey, string>>> {
  const out = new Map<number, Partial<Record<RowKey, string>>>();
  for (const [phaseId, row] of values) {
    const phaseErrors: Partial<Record<RowKey, string>> = {};
    for (const col of COLUMNS) {
      const v = row[col.key];
      if (!Number.isFinite(v) || v < 0) {
        phaseErrors[col.key] = "Hours must be ≥ 0";
      } else if (v > 99999.99) {
        phaseErrors[col.key] = "Hours must be ≤ 99999.99";
      }
    }
    if (Object.keys(phaseErrors).length > 0) out.set(phaseId, phaseErrors);
  }
  return out;
}

/**
 * Map server-side validation errors back to the per-cell errors map. The
 * server returns errors in the standard {@code ErrorResponse.fieldErrors}
 * shape with keys like {@code "lines[2].onshoreLow"}. We translate those
 * to {@code (phaseId, cellKey)} by matching the lines array index back
 * to its phaseId from the request payload.
 *
 * <p>For Phase 5b, server-side per-cell errors are rare (most validation
 * failures come from missing/extra phase rows, which are top-level
 * messages). The mapping is here so that when the bound checks fire (e.g.
 * onshoreLow < 0 on the server), the offending cell lights up.
 */
function applyServerErrors(_err: ApiError): Map<number, Partial<Record<RowKey, string>>> {
  // TODO(post-5b): server-side per-cell mapping. The backend's
  // @DecimalMin / @DecimalMax annotations surface through
  // MethodArgumentNotValidException → ErrorResponse.fieldErrors, but the
  // keys are array-indexed (`lines[2].onshoreLow`) rather than
  // phase-indexed, and the request loses the sdlcPhaseId ↔ array-index
  // mapping by the time the error returns. The cleanest fix is
  // server-side: include sdlcPhaseId in the structured error so this
  // function becomes a one-liner. Until then, client-side validation
  // catches the common cases (negative / >99999.99) before submit, and
  // any server-side rejection surfaces the message via toast.
  //
  // Track this with the Phase 6 follow-up batch (or whichever maintenance
  // round picks up backend error-shape improvements). Not blocking 5b.
  return new Map();
}

function VersionPill({ versionNumber }: { versionNumber: number }) {
  return (
    <span
      className="inline-flex items-center text-near-black"
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: "var(--color-light-blue-soft)",
        border: "1px solid rgba(187,221,230,0.7)",
      }}
    >
      v{versionNumber} active
    </span>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
