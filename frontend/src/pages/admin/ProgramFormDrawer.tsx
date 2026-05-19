import { useEffect, useState } from "react";
import { Drawer } from "../../components/Drawer";
import { TextInput } from "../../components/inputs";
import { Toggle } from "../../components/Toggle";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../components/buttons";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../lib/api";
import {
  useCreateProgramMutation,
  useUpdateProgramMutation,
} from "../../lib/queries/programs";
import { useAllClientsQuery } from "../../lib/queries/clients";
import type { ProgramDto } from "../../lib/api/programs";

interface ProgramFormDrawerProps {
  open: boolean;
  program: ProgramDto | null;
  onClose: () => void;
  onRequestDelete?: (program: ProgramDto) => void;
}

export function ProgramFormDrawer({
  open,
  program,
  onClose,
  onRequestDelete,
}: ProgramFormDrawerProps) {
  const toast = useToast();
  const isEdit = program != null;

  const [clientId, setClientId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const clientsQuery = useAllClientsQuery();
  const createMutation = useCreateProgramMutation();
  const updateMutation = useUpdateProgramMutation();
  const saving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      setClientId(program?.clientId ?? "");
      setName(program?.name ?? "");
      setActive(program?.active ?? true);
      setNameError(null);
    }
  }, [open, program]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || clientId === "") return;
    setNameError(null);
    try {
      if (isEdit && program) {
        await updateMutation.mutateAsync({
          id: program.id,
          body: { clientId: clientId as number, name: name.trim(), active },
        });
        toast.success("Program updated.");
      } else {
        await createMutation.mutateAsync({
          clientId: clientId as number,
          name: name.trim(),
          active,
        });
        toast.success("Program created.");
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNameError("A program with that name already exists for this client.");
      } else {
        toast.error(err instanceof Error ? err.message : "Could not save program.");
      }
    }
  }

  const activeClients = (clientsQuery.data ?? []).filter((c) => c.active);

  return (
    <Drawer
      open={open}
      title={isEdit ? "Edit program" : "New program"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {isEdit && onRequestDelete && program && (
              <TertiaryButton
                onClick={() => { onClose(); onRequestDelete(program); }}
              >
                Delete
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton
              type="submit"
              form="program-form"
              disabled={saving || !name.trim() || clientId === ""}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create program"}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <form id="program-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="flex flex-col" style={{ gap: 18 }}>
          <div>
            <label
              htmlFor="program-client"
              style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--fg-1)" }}
            >
              Client <span style={{ color: "var(--color-cardinal-red)" }}>*</span>
            </label>
            <select
              id="program-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value === "" ? "" : Number(e.target.value))}
              required
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 14,
                border: "1px solid var(--color-border)",
                borderRadius: 4,
                background: "var(--bg-surface)",
                color: clientId === "" ? "var(--fg-2)" : "var(--fg-1)",
              }}
            >
              <option value="">Select a client…</option>
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <TextInput
            id="program-name"
            label="Program name"
            value={name}
            onChange={(e) => { setName(e.currentTarget.value); setNameError(null); }}
            maxLength={255}
            required
            error={nameError ?? undefined}
          />
          <Toggle
            label={active ? "Active" : "Inactive"}
            checked={active}
            onCheckedChange={setActive}
          />
        </div>
      </form>
    </Drawer>
  );
}
