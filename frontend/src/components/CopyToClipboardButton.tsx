import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CopyToClipboardButtonProps {
  value: string;
  /** Visible label for screen readers. */
  ariaLabel?: string;
  /** Brief feedback hint on successful copy; defaults to "Copied!". */
  copiedLabel?: string;
}

/**
 * Compact icon button that copies a value to the clipboard and shows
 * brief "Copied!" feedback. Falls back to a manual selection prompt if
 * navigator.clipboard isn't available (e.g. older browsers, insecure
 * contexts).
 */
export function CopyToClipboardButton({
  value,
  ariaLabel = "Copy to clipboard",
  copiedLabel = "Copied!",
}: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    setError(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback: legacy execCommand path. Best-effort.
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Press ⌘C to copy");
      window.setTimeout(() => setError(null), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-body font-medium text-near-black bg-white hover:bg-warm-gray-light focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-blue"
      style={{ border: "1px solid var(--color-border-strong)" }}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
          {copiedLabel}
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
          Copy
        </>
      )}
      {error && (
        <span className="text-warm-gray-med ml-1" style={{ fontSize: 11 }}>
          {error}
        </span>
      )}
    </button>
  );
}
