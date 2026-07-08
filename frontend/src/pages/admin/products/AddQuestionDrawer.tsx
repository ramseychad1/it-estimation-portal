import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../../lib/api";
import {
  useCreateProductQuestionMutation,
  useCreateSubFeatureQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
  useActivateQuestionMutation,
  useDeactivateQuestionMutation,
} from "../../../lib/queries/questions";
import { useToast } from "../../../components/Toast";
import { Drawer } from "../../../components/Drawer";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../../components/buttons";
import { Textarea } from "../../../components/inputs";
import { Toggle } from "../../../components/Toggle";
import { FormField } from "../../../components/FormField";
import { ConfirmModal } from "../../../components/ConfirmModal";
import {
  QUESTION_TYPE_LABELS,
  type QuestionDetail,
  type QuestionType,
} from "../../../lib/api/questions";

export type QuestionDrawerParent =
  | { kind: "Product"; id: number; name: string }
  | { kind: "SubFeature"; id: number; name: string };

interface AddQuestionDrawerProps {
  open: boolean;
  parent: QuestionDrawerParent | null;
  /** When set, drawer opens in edit mode for the given question. */
  question?: QuestionDetail | null;
  onClose: () => void;
}

interface FormValues {
  questionText: string;
  helpText: string;
  questionType: QuestionType;
  /** Options editor state: one option per line. */
  optionsText: string;
  required: boolean;
  documentUploadEnabled: boolean;
  documentUploadRequired: boolean;
  active: boolean;
}

/** One option per line -> trimmed, deduped list (mirrors backend normalization). */
function parseOptions(text: string): string[] {
  return [...new Set(text.split("\n").map((o) => o.trim()).filter(Boolean))];
}

function valuesFor(q: QuestionDetail | null | undefined): FormValues {
  return {
    questionText: q?.questionText ?? "",
    helpText: q?.helpText ?? "",
    questionType: q?.questionType ?? "LONG_TEXT",
    optionsText: (q?.options ?? []).join("\n"),
    required: q?.required ?? false,
    documentUploadEnabled: q?.documentUploadEnabled ?? false,
    documentUploadRequired: q?.documentUploadRequired ?? false,
    active: q?.active ?? true,
  };
}

/**
 * Reusable add/edit drawer used both inline on a parent's detail page
 * (Atomic Product detail or SubFeature detail) and from the cross-catalog
 * Critical Questions browser. The {@code question} prop switches it to
 * edit mode (and surfaces the audit footer + Delete link).
 */
export function AddQuestionDrawer({ open, parent, question, onClose }: AddQuestionDrawerProps) {
  const isEdit = !!question;
  const initial = valuesFor(question);
  const [values, setValues] = useState<FormValues>(initial);
  const [error, setError] = useState<{ questionText?: string; options?: string; form?: string }>({});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const createForProduct = useCreateProductQuestionMutation();
  const createForSubFeature = useCreateSubFeatureQuestionMutation();
  const updateMutation = useUpdateQuestionMutation();
  const activateMutation = useActivateQuestionMutation();
  const deactivateMutation = useDeactivateQuestionMutation();
  const deleteMutation = useDeleteQuestionMutation();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(valuesFor(question));
      setError({});
    }
  }, [open, question?.id]);

  const isDirty =
    values.questionText !== initial.questionText ||
    values.helpText !== initial.helpText ||
    values.questionType !== initial.questionType ||
    values.optionsText !== initial.optionsText ||
    values.required !== initial.required ||
    values.documentUploadEnabled !== initial.documentUploadEnabled ||
    values.documentUploadRequired !== initial.documentUploadRequired ||
    values.active !== initial.active;

  const busy =
    createForProduct.isPending ||
    createForSubFeature.isPending ||
    updateMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    deleteMutation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.questionText.trim()) {
      setError({ questionText: "Question text is required." });
      return;
    }
    if (values.questionType === "SINGLE_SELECT" && parseOptions(values.optionsText).length < 2) {
      setError({ options: "Add at least 2 options (one per line)." });
      return;
    }

    try {
      if (isEdit && question) {
        if (values.active !== initial.active) {
          if (values.active) await activateMutation.mutateAsync(question.id);
          else await deactivateMutation.mutateAsync(question.id);
        }
        const textChanged = values.questionText.trim() !== initial.questionText;
        const helpChanged = (values.helpText ?? "").trim() !== (initial.helpText ?? "");
        const requiredChanged = values.required !== initial.required;
        const docEnabledChanged = values.documentUploadEnabled !== initial.documentUploadEnabled;
        const docRequiredChanged = values.documentUploadRequired !== initial.documentUploadRequired;
        const typeChanged = values.questionType !== initial.questionType;
        const optionsChanged =
          values.questionType === "SINGLE_SELECT" && values.optionsText !== initial.optionsText;
        if (textChanged || helpChanged || requiredChanged || docEnabledChanged
            || docRequiredChanged || typeChanged || optionsChanged) {
          await updateMutation.mutateAsync({
            id: question.id,
            body: {
              ...(textChanged ? { questionText: values.questionText.trim() } : {}),
              ...(helpChanged ? { helpText: values.helpText.trim() || null } : {}),
              ...(requiredChanged ? { required: values.required } : {}),
              ...(docEnabledChanged ? { documentUploadEnabled: values.documentUploadEnabled } : {}),
              ...(docRequiredChanged ? { documentUploadRequired: values.documentUploadRequired } : {}),
              ...(typeChanged ? { questionType: values.questionType } : {}),
              ...(typeChanged || optionsChanged
                ? values.questionType === "SINGLE_SELECT"
                  ? { options: parseOptions(values.optionsText) }
                  : {}
                : {}),
            },
          });
        }
        toast.success("Question saved.");
      } else {
        if (!parent) return;
        const body = {
          questionText: values.questionText.trim(),
          helpText: values.helpText.trim() || null,
          required: values.required,
          documentUploadEnabled: values.documentUploadEnabled,
          documentUploadRequired: values.documentUploadRequired,
          questionType: values.questionType,
          ...(values.questionType === "SINGLE_SELECT"
            ? { options: parseOptions(values.optionsText) }
            : {}),
          active: values.active,
        };
        if (parent.kind === "Product") {
          await createForProduct.mutateAsync({ productId: parent.id, body });
        } else {
          await createForSubFeature.mutateAsync({ subFeatureId: parent.id, body });
        }
        toast.success("Question added.");
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ form: "Could not save the question. Please try again." });
      }
    }
  }

  async function handleDelete() {
    if (!question) return;
    try {
      await deleteMutation.mutateAsync(question.id);
      toast.success("Question deleted.");
      setConfirmDeleteOpen(false);
      onClose();
    } catch {
      toast.error("Could not delete the question.");
    }
  }

  const parentName = isEdit
    ? question?.parentName ?? ""
    : parent?.name ?? "";

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        isDirty={isDirty}
        title={isEdit ? `Edit question` : `New question on ${parentName}`}
        subtitle={isEdit ? `On ${parentName}` : undefined}
        footer={
          <>
            <div>
              {isEdit && (
                <TertiaryButton
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="text-cardinal-red hover:text-cardinal-red"
                >
                  Delete question
                </TertiaryButton>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SecondaryButton onClick={onClose} disabled={busy}>Cancel</SecondaryButton>
              <PrimaryButton form="question-form" type="submit" disabled={busy || (isEdit && !isDirty)}>
                {busy ? "Saving…" : isEdit ? "Save" : "Add question"}
              </PrimaryButton>
            </div>
          </>
        }
      >
        <form id="question-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Textarea
            label="Question text"
            required
            rows={3}
            value={values.questionText}
            onChange={(e) => setValues((v) => ({ ...v, questionText: e.target.value }))}
            error={error.questionText}
            placeholder="What does the requester need to tell us?"
            disabled={busy}
          />

          <Textarea
            label="Helper text shown to requester"
            helper="Optional. Short hint or example."
            rows={2}
            value={values.helpText}
            onChange={(e) => setValues((v) => ({ ...v, helpText: e.target.value }))}
            disabled={busy}
          />

          <FormField label="Answer type" helper="How the requester answers. Changing this on an existing question does not touch already-submitted answers.">
            {(field) => (
              <select
                id={field.id}
                value={values.questionType}
                onChange={(e) =>
                  setValues((v) => ({ ...v, questionType: e.target.value as QuestionType }))
                }
                disabled={busy}
                className="h-8 px-2 rounded-md border border-border bg-white text-body focus:outline-none focus:border-warm-gray-med focus:ring-2 focus:ring-accent"
                style={{ maxWidth: 240 }}
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
          </FormField>

          {values.questionType === "SINGLE_SELECT" && (
            <Textarea
              label="Options"
              helper="One option per line. Requesters pick exactly one."
              rows={4}
              value={values.optionsText}
              onChange={(e) => setValues((v) => ({ ...v, optionsText: e.target.value }))}
              error={error.options}
              placeholder={"Pilot\nFull rollout"}
              disabled={busy}
            />
          )}

          <FormField label="Required">
            {(field) => (
              <div id={field.id}>
                <Toggle
                  checked={values.required}
                  onCheckedChange={(next) => setValues((v) => ({ ...v, required: next }))}
                  label={values.required ? "Requester must answer" : "Optional"}
                  disabled={busy}
                />
              </div>
            )}
          </FormField>

          <FormField label="Document upload">
            {(field) => (
              <div id={field.id} className="flex flex-col gap-2">
                <Toggle
                  checked={values.documentUploadEnabled}
                  onCheckedChange={(next) =>
                    setValues((v) => ({
                      ...v,
                      documentUploadEnabled: next,
                      documentUploadRequired: next ? v.documentUploadRequired : false,
                    }))
                  }
                  label={values.documentUploadEnabled ? "Requester must upload a file" : "No file upload"}
                  disabled={busy}
                />
                {values.documentUploadEnabled && (
                  <div className="flex items-center gap-4 pl-1" style={{ fontSize: 13 }}>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="docUploadRequired"
                        checked={!values.documentUploadRequired}
                        onChange={() => setValues((v) => ({ ...v, documentUploadRequired: false }))}
                        disabled={busy}
                      />
                      Optional
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="docUploadRequired"
                        checked={values.documentUploadRequired}
                        onChange={() => setValues((v) => ({ ...v, documentUploadRequired: true }))}
                        disabled={busy}
                      />
                      Required
                    </label>
                  </div>
                )}
              </div>
            )}
          </FormField>

          <FormField label="Status">
            {(field) => (
              <div id={field.id}>
                <Toggle
                  checked={values.active}
                  onCheckedChange={(next) => setValues((v) => ({ ...v, active: next }))}
                  label={values.active ? "Active" : "Inactive"}
                  disabled={busy}
                />
              </div>
            )}
          </FormField>

          {error.form && (
            <p className="m-0" role="alert" style={{ fontSize: 12, color: "var(--color-cardinal-red)" }}>
              {error.form}
            </p>
          )}
        </form>
      </Drawer>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete this question?"
        body={
          <p className="m-0" style={{ fontSize: 14 }}>
            The question will be removed from <strong>'{parentName}'</strong>. This cannot be undone.
          </p>
        }
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        confirmLabel="Delete question"
        destructive
      />
    </>
  );
}
