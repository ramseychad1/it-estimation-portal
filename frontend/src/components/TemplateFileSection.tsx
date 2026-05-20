import { Paperclip, Download, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import type { TemplateFileMeta } from "../lib/api/templateFiles";
import { downloadTemplateFile } from "../lib/api/templateFiles";
import { useToast } from "./Toast";

interface TemplateFileSectionProps {
  /** Current file attached to the entity, or null if none. */
  file: TemplateFileMeta | null | undefined;
  /** Called with the chosen File — caller handles the upload mutation. */
  onUpload: (file: File) => Promise<unknown>;
  /** Called when the user confirms removal. */
  onDelete: () => Promise<unknown>;
  /** URL for the download endpoint (product or sub-feature). */
  downloadUrl: string;
  /** When true, all actions are disabled (e.g. parent form is submitting). */
  disabled?: boolean;
}

const ALLOWED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx";
const MAX_MB = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Inline section rendered inside the edit drawers for Product and Sub-feature.
 * Shows the current attached template file (if any) with download + remove
 * actions, or a file picker when empty. Upload is an upsert — replacing an
 * existing file follows the same path as the initial upload.
 */
export function TemplateFileSection({
  file,
  onUpload,
  onDelete,
  downloadUrl,
  disabled = false,
}: TemplateFileSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const busy = uploading || deleting || disabled;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    if (picked.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds the ${MAX_MB} MB limit.`);
      return;
    }

    setUploading(true);
    try {
      await onUpload(picked);
      toast.success("Template file uploaded.");
    } catch {
      toast.error("Could not upload the file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
      toast.success("Template file removed.");
    } catch {
      toast.error("Could not remove the file.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (!file) return;
    try {
      await downloadTemplateFile(downloadUrl, file.originalFilename);
    } catch {
      toast.error("Could not download the file.");
    }
  }

  return (
    <div>
      <p
        className="text-near-black mb-2"
        style={{ fontSize: 13, fontWeight: 500 }}
      >
        Template file
      </p>

      {file ? (
        <div
          className="flex items-center gap-3 rounded-md border border-warm-gray-light px-3 py-2"
          style={{ fontSize: 12 }}
        >
          <Paperclip size={14} className="text-warm-gray-med shrink-0" strokeWidth={1.5} />
          <span className="text-near-black truncate flex-1">{file.originalFilename}</span>
          <span className="text-warm-gray-med shrink-0">{formatBytes(file.fileSizeBytes)}</span>

          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="text-warm-gray-med hover:text-near-black disabled:opacity-40 shrink-0"
            title="Download"
          >
            <Download size={14} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-warm-gray-med hover:text-cardinal-red disabled:opacity-40 shrink-0"
            title={deleting ? "Removing…" : "Remove file"}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>

          {/* Replace — same input slot */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-warm-gray-med hover:text-near-black disabled:opacity-40 shrink-0"
            title="Replace file"
          >
            <UploadCloud size={14} strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-md border border-dashed border-warm-gray-med px-3 py-2 text-warm-gray-med hover:border-near-black hover:text-near-black disabled:opacity-40 w-full"
          style={{ fontSize: 12 }}
        >
          <UploadCloud size={14} strokeWidth={1.5} className="shrink-0" />
          <span>{uploading ? "Uploading…" : "Attach template file (PDF, Word, Excel · max 10 MB)"}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        className="sr-only"
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
