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
import type { ClientDto } from "../../lib/api/clients";

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

  const createMutation = useCreateClientMutation();
  const updateMutation = useUpdateClientMutation();
  const saving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setPoc(client?.pointOfContact ?? "");
      setActive(client?.active ?? true);
      setNameError(null);
    }
  }, [open, client]);

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
        </div>
      </form>
    </Drawer>
  );
}
