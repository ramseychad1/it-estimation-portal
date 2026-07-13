import { useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { TextInput } from "../../components/inputs";
import { Toggle } from "../../components/Toggle";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../components/buttons";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../lib/api";
import {
  useCreateClientMutation,
  useUpdateClientMutation,
} from "../../lib/queries/clients";
import {
  useClientPricingQuery,
  useUpdateClientPricingMutation,
} from "../../lib/queries/clientPricing";
import { linkedTmField } from "../../lib/estimateMath";
import type { ClientDto } from "../../lib/api/clients";

/** Parses a numeric input string to a number, or null when blank/invalid. */
function parseOptionalNum(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

/** Shows a global default value inline, e.g. "1.5" → " (global: 1.5)". */
function globalHint(value: number | null, suffix = ""): string {
  return value != null ? ` (global: ${value}${suffix})` : "";
}

interface ClientFormDrawerProps {
  open: boolean;
  client: ClientDto | null;
  onClose: () => void;
  onRequestDelete?: (client: ClientDto) => void;
}

export function ClientFormDrawer({
  open,
  client,
  onClose,
  onRequestDelete,
}: ClientFormDrawerProps) {
  const toast = useToast();
  const isEdit = client != null;

  const [name, setName] = useState("");
  const [poc, setPoc] = useState("");
  const [active, setActive] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  // Per-client pricing overrides (edit mode only — a client must exist first).
  const [tmMultiplier, setTmMultiplier] = useState("");
  const [tmTargetMarginPct, setTmTargetMarginPct] = useState("");
  const [matBillableRate, setMatBillableRate] = useState("");
  const [matDiscountPct, setMatDiscountPct] = useState("");

  const createMutation = useCreateClientMutation();
  const updateMutation = useUpdateClientMutation();
  const updatePricingMutation = useUpdateClientPricingMutation();
  const saving =
    createMutation.isPending || updateMutation.isPending || updatePricingMutation.isPending;

  const pricingQuery = useClientPricingQuery(isEdit && open ? client!.id : null);
  const globalDefaults = pricingQuery.data?.defaults ?? null;

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setPoc(client?.pointOfContact ?? "");
      setActive(client?.active ?? true);
      setNameError(null);
    }
  }, [open, client]);

  // Populate override inputs once this client's pricing config loads.
  useEffect(() => {
    const p = pricingQuery.data;
    if (open && p) {
      setTmMultiplier(p.overrideTmMultiplier != null ? String(p.overrideTmMultiplier) : "");
      setTmTargetMarginPct(
        p.overrideTmTargetMarginPct != null ? String(p.overrideTmTargetMarginPct) : "",
      );
      setMatBillableRate(p.overrideMatBillableRate != null ? String(p.overrideMatBillableRate) : "");
      setMatDiscountPct(p.overrideMatDiscountPct != null ? String(p.overrideMatDiscountPct) : "");
    }
  }, [open, pricingQuery.data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !poc.trim()) return;
    setNameError(null);
    try {
      if (isEdit && client) {
        await updateMutation.mutateAsync({
          id: client.id,
          body: { name: name.trim(), pointOfContact: poc.trim(), active },
        });
        await updatePricingMutation.mutateAsync({
          id: client.id,
          body: {
            overrideTmMultiplier: parseOptionalNum(tmMultiplier),
            overrideTmTargetMarginPct: parseOptionalNum(tmTargetMarginPct),
            overrideMatBillableRate: parseOptionalNum(matBillableRate),
            overrideMatDiscountPct: parseOptionalNum(matDiscountPct),
          },
        });
        toast.success("Client updated.");
      } else {
        await createMutation.mutateAsync({
          name: name.trim(), pointOfContact: poc.trim(), active,
        });
        toast.success("Client created.");
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNameError("A client with that name already exists.");
      } else {
        toast.error(err instanceof Error ? err.message : "Could not save client.");
      }
    }
  }

  return (
    <Drawer
      open={open}
      title={isEdit ? "Edit client" : "New client"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {isEdit && onRequestDelete && client && (
              <TertiaryButton
                onClick={() => { onClose(); onRequestDelete(client); }}
              >
                Delete
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton
              type="submit"
              form="client-form"
              disabled={saving || !name.trim() || !poc.trim()}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create client"}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <form id="client-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="flex flex-col" style={{ gap: 18 }}>
          <TextInput
            id="client-name"
            label="Client name"
            value={name}
            onChange={(e) => { setName(e.currentTarget.value); setNameError(null); }}
            maxLength={255}
            required
            error={nameError ?? undefined}
          />
          <TextInput
            id="client-poc"
            label="Point of contact"
            value={poc}
            onChange={(e) => setPoc(e.currentTarget.value)}
            maxLength={255}
            required
          />
          <Toggle
            label={active ? "Active" : "Inactive"}
            checked={active}
            onCheckedChange={setActive}
          />

          {isEdit && (
            <div style={{ borderTop: "1px solid var(--color-warm-gray-light)", paddingTop: 16 }}>
              <p className="font-semibold text-near-black m-0" style={{ fontSize: 13 }}>
                Client pricing
              </p>
              <p className="text-warm-gray-med m-0 mb-3" style={{ fontSize: 12 }}>
                Overrides the global pricing for this client. Leave a field blank to inherit the
                global value.
              </p>

              {pricingQuery.isLoading ? (
                <p className="text-warm-gray-med" style={{ fontSize: 13 }}>Loading pricing…</p>
              ) : (
                <div className="flex flex-col" style={{ gap: 16 }}>
                  {/* Margin-based */}
                  <div>
                    <p
                      className="font-semibold text-near-black m-0 mb-2"
                      style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}
                    >
                      Target Margin
                    </p>
                    <div className="flex flex-col gap-3">
                      <TextInput
                        label={`Multiplier${globalHint(globalDefaults?.tmMultiplier ?? null)}`}
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="Use global"
                        value={tmMultiplier}
                        onChange={(e) => {
                          const l = linkedTmField("multiplier", e.currentTarget.value);
                          setTmMultiplier(l.multiplier);
                          setTmTargetMarginPct(l.targetMarginPct);
                        }}
                        disabled={saving}
                      />
                      <TextInput
                        label={`Target margin %${globalHint(globalDefaults?.tmTargetMarginPct ?? null, "%")}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Use global"
                        value={tmTargetMarginPct}
                        onChange={(e) => {
                          const l = linkedTmField("margin", e.currentTarget.value);
                          setTmMultiplier(l.multiplier);
                          setTmTargetMarginPct(l.targetMarginPct);
                        }}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Time & Materials */}
                  <div>
                    <p
                      className="font-semibold text-near-black m-0 mb-2"
                      style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}
                    >
                      Time &amp; Materials
                    </p>
                    <div className="flex flex-col gap-3">
                      <TextInput
                        label={`Billable rate ($/hr)${globalHint(globalDefaults?.matBillableRate ?? null)}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Use global"
                        value={matBillableRate}
                        onChange={(e) => setMatBillableRate(e.currentTarget.value)}
                        disabled={saving}
                      />
                      <TextInput
                        label={`Discount %${globalHint(globalDefaults?.matDiscountPct ?? null, "%")}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Use global"
                        value={matDiscountPct}
                        onChange={(e) => setMatDiscountPct(e.currentTarget.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </Drawer>
  );
}
