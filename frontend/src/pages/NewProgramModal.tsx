import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "../components/buttons";
import { TextInput } from "../components/inputs";
import { ApiError } from "../lib/api";
import { createProgram } from "../lib/api/programs";
import type { ProgramDto } from "../lib/api/programs";
import { useQueryClient } from "@tanstack/react-query";

interface NewProgramModalProps {
  open: boolean;
  clientId: number;
  clientName: string;
  onClose: () => void;
  onCreated: (program: ProgramDto) => void;
}

export function NewProgramModal({
  open,
  clientId,
  clientName,
  onClose,
  onCreated,
}: NewProgramModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createProgram({ clientId, name: name.trim(), active: true });
      void qc.invalidateQueries({ queryKey: ["programs"] });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("A program with that name already exists for this client.");
      } else {
        setError(err instanceof Error ? err.message : "Could not create program.");
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
          width: 400,
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
            New program
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
            {/* Read-only client label */}
            <div>
              <div
                className="text-near-black font-medium"
                style={{ fontSize: 13, marginBottom: 4 }}
              >
                Client
              </div>
              <div
                style={{
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 10px",
                  background: "var(--color-warm-gray-light)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--fg-2)",
                }}
              >
                {clientName}
              </div>
            </div>
            <TextInput
              ref={nameRef}
              id="new-program-name"
              label="Program name"
              value={name}
              onChange={(e) => { setName(e.currentTarget.value); setError(null); }}
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
              disabled={saving || !name.trim()}
            >
              {saving ? "Creating…" : "Create program"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
