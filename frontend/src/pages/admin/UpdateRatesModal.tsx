import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";
import { useCreateRateMutation } from "../../lib/queries/rates";
import { useToast } from "../../components/Toast";
import { PrimaryButton, SecondaryButton } from "../../components/buttons";
import { TextInput, Textarea } from "../../components/inputs";
import { FormField } from "../../components/FormField";
import { formatDelta, formatMoney, parseMoney } from "../../lib/money";

interface UpdateRatesModalProps {
  open: boolean;
  onClose: () => void;
  /** When null, the modal opens in initial-setup mode ("Set Initial Rates"). */
  currentOnshore: number | null;
  currentOffshore: number | null;
  /** Optional pre-fill for the "Revert to this rate" handoff from the drawer. */
  prefill?: {
    onshoreRate: string;
    offshoreRate: string;
    note?: string | null;
  } | null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function UpdateRatesModal({
  open,
  onClose,
  currentOnshore,
  currentOffshore,
  prefill,
}: UpdateRatesModalProps) {
  const isInitial = currentOnshore === null && currentOffshore === null;

  const [onshore, setOnshore] = useState("");
  const [offshore, setOffshore] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayIsoDate());
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ onshoreRate?: string; offshoreRate?: string }>({});

  const createMutation = useCreateRateMutation();
  const toast = useToast();

  // Reset form whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setOnshore(prefill?.onshoreRate ?? "");
    setOffshore(prefill?.offshoreRate ?? "");
    setEffectiveDate(todayIsoDate());
    setNote(prefill?.note ?? "");
    setAcknowledged(false);
    setError(null);
    setFieldError({});
  }, [open, prefill]);

  const onshoreNum = useMemo(() => parseMoney(onshore), [onshore]);
  const offshoreNum = useMemo(() => parseMoney(offshore), [offshore]);

  const onshoreDelta =
    !isInitial && onshoreNum !== null && currentOnshore !== null && onshoreNum !== currentOnshore
      ? formatDelta(currentOnshore, onshoreNum)
      : null;
  const offshoreDelta =
    !isInitial && offshoreNum !== null && currentOffshore !== null && offshoreNum !== currentOffshore
      ? formatDelta(currentOffshore, offshoreNum)
      : null;

  const isValid =
    onshoreNum !== null &&
    onshoreNum > 0 &&
    onshoreNum <= 9999.99 &&
    offshoreNum !== null &&
    offshoreNum > 0 &&
    offshoreNum <= 9999.99 &&
    !!effectiveDate &&
    acknowledged;

  const busy = createMutation.isPending;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError({});
    if (!isValid) return;
    try {
      await createMutation.mutateAsync({
        onshoreRate: onshoreNum!.toFixed(2),
        offshoreRate: offshoreNum!.toFixed(2),
        effectiveDate,
        note: note.trim() || null,
        confirmationAcknowledged: true,
      });
      toast.success(isInitial ? "Initial rates set." : "New rates saved.");
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { fieldErrors?: Record<string, string>; message?: string } | null;
        if (body?.fieldErrors) {
          setFieldError({
            onshoreRate: body.fieldErrors.onshoreRate,
            offshoreRate: body.fieldErrors.offshoreRate,
          });
        }
        setError(body?.message ?? "Could not save rates.");
      } else {
        setError("Could not save rates.");
      }
    }
  }

  if (!open) return null;

  const title = isInitial ? "Set Initial Rates" : "Update Blended Rates";
  const submitLabel = isInitial ? "Save Initial Rates" : "Save New Rates";

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(39,37,31,0.40)" }}
      />
      <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none" style={{ paddingTop: 64 }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="bg-white rounded-lg overflow-hidden flex flex-col pointer-events-auto"
          style={{ width: 560, boxShadow: "var(--shadow-modal)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <header style={{ padding: "20px 24px 8px" }} className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-near-black" style={{ fontSize: 18, letterSpacing: "-0.005em" }}>
                {title}
              </div>
              <div className="text-warm-gray-med mt-1" style={{ fontSize: 13, lineHeight: "18px" }}>
                {isInitial
                  ? "Set the workspace's first onshore + offshore blended rates."
                  : "Create a new rate row. Existing rates remain in history; nothing is overwritten."}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="bg-transparent border-0 cursor-pointer text-warm-gray-med hover:text-near-black hover:bg-warm-gray-light rounded"
              style={{ width: 28, height: 28, fontSize: 18, lineHeight: "20px" }}
            >
              ×
            </button>
          </header>

          <form id="update-rates-form" onSubmit={handleSubmit} noValidate>
            <div style={{ padding: "0 24px 16px" }}>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <RateInput
                  label="Onshore rate"
                  required
                  value={onshore}
                  onChange={setOnshore}
                  helper={isInitial ? "Per hour" : `Current: $${formatMoney(currentOnshore)}`}
                  delta={onshoreDelta}
                  error={fieldError.onshoreRate}
                  disabled={busy}
                />
                <RateInput
                  label="Offshore rate"
                  required
                  value={offshore}
                  onChange={setOffshore}
                  helper={isInitial ? "Per hour" : `Current: $${formatMoney(currentOffshore)}`}
                  delta={offshoreDelta}
                  error={fieldError.offshoreRate}
                  disabled={busy}
                />
              </div>

              <div className="mt-4">
                <TextInput
                  label="Effective date"
                  required
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  helper="Rates become effective at 12:00 AM on this date."
                  disabled={busy}
                />
              </div>

              <div className="mt-4">
                <Textarea
                  label="Reason for change (recommended)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  helper="A brief reason saved alongside the rate change."
                  disabled={busy}
                />
              </div>

              <label
                className="flex items-start gap-2.5 mt-4 pt-3 cursor-pointer"
                style={{ borderTop: "1px solid var(--color-warm-gray-light)" }}
              >
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  disabled={busy}
                  style={{ accentColor: "var(--color-near-black)", width: 16, height: 16, marginTop: 2 }}
                />
                <span className="text-near-black" style={{ fontSize: 13, lineHeight: "18px" }}>
                  I understand this change will be recorded in the audit log and cannot be deleted.
                </span>
              </label>

              {error && (
                <p className="text-small text-cardinal-red mt-3" role="alert">
                  {error}
                </p>
              )}
            </div>

            <footer
              className="flex items-center justify-end gap-2"
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--color-warm-gray-light)",
                background: "#FBFBFA",
              }}
            >
              <SecondaryButton type="button" onClick={onClose} disabled={busy}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={busy || !isValid}>
                {busy ? "Saving…" : submitLabel}
              </PrimaryButton>
            </footer>
          </form>
        </div>
      </div>
    </>
  );
}

// ---- internal -----------------------------------------------------------

function RateInput({
  label,
  required,
  value,
  onChange,
  helper,
  delta,
  error,
  disabled,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (next: string) => void;
  helper: string;
  delta: ReturnType<typeof formatDelta> | null;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <FormField label={label} required={required} helper={helper} error={error}>
      {(field) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute text-warm-gray-med"
            style={{ left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}
          >
            $
          </span>
          <input
            {...field}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="0.00"
            className={`w-full h-9 px-3 rounded-md border text-body text-near-black tabular focus:outline-none focus:ring-2 focus:ring-light-blue ${
              error ? "border-cardinal-red" : "border-border-strong focus:border-warm-gray-med"
            }`}
            style={{ paddingLeft: 26, fontWeight: 500 }}
          />
          {delta && !error && (
            <p
              className="mt-1 text-warm-gray-med"
              style={{ fontSize: 12 }}
              data-testid={`delta-${label.toLowerCase().replace(/\s/g, "-")}`}
            >
              Change: {delta.text}
            </p>
          )}
        </div>
      )}
    </FormField>
  );
}
