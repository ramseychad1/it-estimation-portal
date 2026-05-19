import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "../components/buttons";
import { TextInput } from "../components/inputs";
import { ApiError } from "../lib/api";
import { createClient } from "../lib/api/clients";
import type { ClientDto } from "../lib/api/clients";
import { useQueryClient } from "@tanstack/react-query";

interface NewClientModalProps {
  open: boolean;
  defaultPointOfContact: string;
  onClose: () => void;
  onCreated: (client: ClientDto) => void;
}

export function NewClientModal({
  open,
  defaultPointOfContact,
  onClose,
  onCreated,
}: NewClientModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [poc, setPoc] = useState(defaultPointOfContact);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setPoc(defaultPointOfContact);
      setError(null);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, defaultPointOfContact]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !poc.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createClient({ name: name.trim(), pointOfContact: poc.trim(), active: true });
      void qc.invalidateQueries({ queryKey: ["clients"] });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("A client with that name already exists.");
      } else {
        setError(err instanceof Error ? err.message : "Could not create client.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 200, background: "rgba(0,0,0,0.35)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg"
        style={{
          width: 420,
          border: "1px solid var(--color-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-warm-gray-light)",
          }}
        >
          <span className="text-near-black font-semibold" style={{ fontSize: 15 }}>
            New client
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              color: "var(--fg-2)",
              display: "inline-flex",
              padding: 4,
            }}
          >
            <X style={{ width: 16, height: 16 }} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: 16 }}>
            <TextInput
              ref={nameRef}
              id="new-client-name"
              label="Client name"
              value={name}
              onChange={(e) => { setName(e.currentTarget.value); setError(null); }}
              maxLength={255}
              required
            />
            <TextInput
              id="new-client-poc"
              label="Point of contact"
              value={poc}
              onChange={(e) => setPoc(e.currentTarget.value)}
              maxLength={255}
              required
            />
            {error && (
              <p className="text-cardinal-red" style={{ fontSize: 13, margin: 0 }}>
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              padding: "16px 20px",
            }}
          >
            <SecondaryButton type="button" onClick={onClose}>
              Cancel
            </SecondaryButton>
            <PrimaryButton
              type="submit"
              disabled={saving || !name.trim() || !poc.trim()}
            >
              {saving ? "Creating…" : "Create client"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
