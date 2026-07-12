import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Info } from "lucide-react";
import { ApiError } from "../../lib/api";
import {
  useActivatePhaseMutation,
  useCreatePhaseMutation,
  useDeactivatePhaseMutation,
  useUpdatePhaseMutation,
} from "../../lib/queries/phases";
import { useToast } from "../../components/Toast";
import { Drawer } from "../../components/Drawer";
import {
  PrimaryButton,
  SecondaryButton,
  TertiaryButton,
} from "../../components/buttons";
import { TextInput, Textarea } from "../../components/inputs";
import { Toggle } from "../../components/Toggle";
import { FormField } from "../../components/FormField";
import { UserCell } from "../../components/UserCell";
import { relativeTime } from "../../lib/relativeTime";
import type { SdlcPhaseDto } from "../../lib/api/phases";

interface SdlcPhaseFormDrawerProps {
  open: boolean;
  /** When set, the drawer opens in edit mode for the given phase. */
  phase: SdlcPhaseDto | null;
  onClose: () => void;
  onShowHistory?: (phase: SdlcPhaseDto) => void;
  onRequestDelete?: (phase: SdlcPhaseDto) => void;
}

interface FormValues {
  name: string;
  description: string;
  active: boolean;
  // Benchmark %s held as display strings ("35" = 35%); "" = unset.
  low: string;
  mid: string;
  high: string;
  offshore: string;
  devAnchor: boolean;
}

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
/** fraction (0.35) → percent string ("35"); null → "". */
function fracToPct(f: number | null | undefined): string {
  if (f === null || f === undefined) return "";
  return String(round(f * 100, 2));
}
/** percent string ("35") → fraction (0.35); blank → null. */
function pctToFrac(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? round(n / 100, 4) : null;
}

function valuesFor(phase: SdlcPhaseDto | null): FormValues {
  return {
    name: phase?.name ?? "",
    description: phase?.description ?? "",
    active: phase?.active ?? true,
    low: fracToPct(phase?.benchmarkLowPct),
    mid: fracToPct(phase?.benchmarkMidPct),
    high: fracToPct(phase?.benchmarkHighPct),
    offshore: fracToPct(phase?.defaultOffshorePct ?? 0),
    devAnchor: phase?.devAnchor ?? false,
  };
}

export function SdlcPhaseFormDrawer({
  open,
  phase,
  onClose,
  onShowHistory,
  onRequestDelete,
}: SdlcPhaseFormDrawerProps) {
  const isEdit = !!phase;
  const isSystem = phase?.system === true;
  const initial = useMemo(() => valuesFor(phase), [phase]);
  const [values, setValues] = useState<FormValues>(initial);
  const [fieldError, setFieldError] = useState<{ name?: string; form?: string }>({});

  const createMutation = useCreatePhaseMutation();
  const updateMutation = useUpdatePhaseMutation();
  const activateMutation = useActivatePhaseMutation();
  const deactivateMutation = useDeactivatePhaseMutation();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(initial);
      setFieldError({});
    }
  }, [open, initial]);

  const isDirty =
    values.name !== initial.name ||
    values.description !== initial.description ||
    values.active !== initial.active ||
    values.low !== initial.low ||
    values.mid !== initial.mid ||
    values.high !== initial.high ||
    values.offshore !== initial.offshore ||
    values.devAnchor !== initial.devAnchor;

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending;

  const lowGtHigh = (() => {
    const lo = pctToFrac(values.low);
    const hi = pctToFrac(values.high);
    return lo !== null && hi !== null && lo > hi;
  })();

  const canSave =
    !busy && values.name.trim().length > 0 && !lowGtHigh && (!isEdit || isDirty);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError({});
    try {
      if (!isEdit) {
        await createMutation.mutateAsync({
          name: values.name.trim(),
          description: values.description.trim() || null,
          active: values.active,
        });
        toast.success("Phase created.");
      } else {
        if (values.active !== initial.active) {
          if (values.active) await activateMutation.mutateAsync(phase!.id);
          else await deactivateMutation.mutateAsync(phase!.id);
        }
        const nameChanged = values.name.trim() !== initial.name;
        const descChanged = (values.description || "").trim() !== (initial.description || "");
        const body = {
          ...(nameChanged ? { name: values.name.trim() } : {}),
          ...(descChanged ? { description: values.description.trim() || null } : {}),
          ...(values.low !== initial.low ? { benchmarkLowPct: pctToFrac(values.low) } : {}),
          ...(values.mid !== initial.mid ? { benchmarkMidPct: pctToFrac(values.mid) } : {}),
          ...(values.high !== initial.high ? { benchmarkHighPct: pctToFrac(values.high) } : {}),
          ...(values.offshore !== initial.offshore
            ? { defaultOffshorePct: pctToFrac(values.offshore) ?? 0 }
            : {}),
          // Only ever *set* the anchor here — clearing it is rejected server-side.
          ...(values.devAnchor !== initial.devAnchor && values.devAnchor ? { devAnchor: true } : {}),
        };
        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({ id: phase!.id, body });
        }
        toast.success("Phase saved.");
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldError({ name: "A phase with that name already exists." });
      } else if (err instanceof Error) {
        setFieldError({ form: err.message });
      } else {
        setFieldError({ form: "Could not save changes." });
      }
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      title={isEdit ? `Edit phase: ${phase!.name}` : "New phase"}
      subtitle={isEdit ? undefined : "Add a phase to the SDLC sequence."}
      footer={
        <>
          <div>
            {isEdit && !isSystem && onRequestDelete && (
              <TertiaryButton
                onClick={() => onRequestDelete(phase!)}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Delete phase
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton form="phase-form" type="submit" disabled={!canSave}>
              {busy ? "Saving…" : isEdit ? "Save" : "Create phase"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      {isSystem && (
        <div
          role="note"
          className="flex items-start gap-2 mb-4"
          style={{
            background: "rgba(187, 221, 230, 0.30)",
            border: "1px solid rgba(187,221,230,0.7)",
            borderRadius: 6,
            padding: "10px 12px",
            color: "var(--fg-1)",
            fontSize: 13,
          }}
        >
          <Info className="w-4 h-4 mt-0.5 flex-none" strokeWidth={1.5} />
          <span>
            <strong>System phase.</strong> Name, description, and active status can be edited. The
            phase cannot be deleted — deactivate it instead.
          </span>
        </div>
      )}

      <form id="phase-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="Name"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={fieldError.name}
          disabled={busy}
        />
        <Textarea
          label="Description"
          helper="Optional. Used as a hint when filling in estimates."
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={3}
          disabled={busy}
        />
        {isEdit && (
          <FormField
            label="Display order"
            helper="Drag rows in the list to reorder."
          >
            {(field) => (
              <input
                {...field}
                type="text"
                readOnly
                value={String(phase!.displayOrder)}
                className="w-24 h-8 px-3 rounded-md text-body text-warm-gray-med bg-warm-gray-light"
                style={{ border: "1px solid var(--color-border)" }}
              />
            )}
          </FormField>
        )}
        <FormField label="Status">
          {(field) => (
            <div id={field.id} className="flex items-center justify-between mt-1">
              <Toggle
                checked={values.active}
                onCheckedChange={(next) => setValues((v) => ({ ...v, active: next }))}
                label={values.active ? "Active" : "Inactive"}
                disabled={busy}
              />
            </div>
          )}
        </FormField>

        {isEdit && (
          <div className="pt-3" style={{ borderTop: "1px solid var(--color-warm-gray-light)" }}>
            <div
              className="text-warm-gray-med uppercase font-medium mb-1"
              style={{ fontSize: 11, letterSpacing: "0.06em" }}
            >
              Benchmark distribution
            </div>
            <p
              className="text-warm-gray-med"
              style={{ fontSize: 12, marginTop: 0, marginBottom: 10, lineHeight: 1.5 }}
            >
              This phase's share of the whole project. <strong>Mid</strong> drives the estimate;
              Low/High are the reference band. The ask's Low/Med/High complexity comes from dev
              hours in the builder, not here.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <PctField label="Low %" value={values.low} onChange={(v) => setValues((s) => ({ ...s, low: v }))} disabled={busy} />
              <PctField label="Mid %" value={values.mid} onChange={(v) => setValues((s) => ({ ...s, mid: v }))} disabled={busy} />
              <PctField label="High %" value={values.high} onChange={(v) => setValues((s) => ({ ...s, high: v }))} disabled={busy} />
              <PctField label="Offshore %" value={values.offshore} onChange={(v) => setValues((s) => ({ ...s, offshore: v }))} disabled={busy} />
            </div>
            {lowGtHigh && (
              <p className="text-small text-cardinal-red" style={{ marginTop: 6 }}>
                Low % can't exceed High %.
              </p>
            )}
            <label
              style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--fg-1)" }}
            >
              <input
                type="checkbox"
                checked={values.devAnchor}
                disabled={busy || initial.devAnchor}
                onChange={(e) => setValues((s) => ({ ...s, devAnchor: e.target.checked }))}
              />
              <span>
                Dev-hours anchor
                {initial.devAnchor ? (
                  <span className="text-warm-gray-med"> — this phase (set another to move it)</span>
                ) : (
                  <span className="text-warm-gray-med"> — the entered dev hours are for this phase</span>
                )}
              </span>
            </label>
          </div>
        )}

        {fieldError.form && (
          <p className="text-small text-cardinal-red" role="alert">
            {fieldError.form}
          </p>
        )}
      </form>

      {isEdit && phase && (
        <div className="mt-8 pt-4" style={{ borderTop: "1px solid var(--color-warm-gray-light)" }}>
          <div
            className="text-warm-gray-med uppercase font-medium mb-2"
            style={{ fontSize: 11, letterSpacing: "0.06em" }}
          >
            Audit
          </div>
          <div className="flex flex-col gap-1 text-warm-gray-med" style={{ fontSize: 12 }}>
            <div className="inline-flex items-center gap-2">
              <span>Created by</span>
              <UserCell userId={phase.createdBy} />
              <span>· {relativeTime(phase.createdAt)}</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span>Last updated by</span>
              <UserCell userId={phase.updatedBy} />
              <span>· {relativeTime(phase.updatedAt)}</span>
            </div>
            {onShowHistory && (
              <button
                type="button"
                onClick={() => onShowHistory(phase)}
                className="self-start mt-1 text-near-black font-medium bg-transparent border-0 cursor-pointer hover:underline"
                style={{ fontSize: 12 }}
              >
                View change history →
              </button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function PctField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        style={{ fontSize: 11, fontWeight: 500, display: "block", marginBottom: 4, color: "var(--color-near-black)" }}
      >
        {label}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "6px 8px",
          border: "1px solid var(--color-warm-gray-light)",
          borderRadius: 6,
          fontSize: 13,
          textAlign: "right",
          background: disabled ? "var(--color-warm-gray-lightest, #f5f5f4)" : "#fff",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
