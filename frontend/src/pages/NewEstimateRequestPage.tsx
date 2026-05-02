import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { ConfirmModal } from "../components/ConfirmModal";
import { PageHeader } from "../components/PageHeader";
import { Stepper } from "../components/Stepper";
import { Textarea, TextInput } from "../components/inputs";
import {
  PrimaryButton,
  SecondaryButton,
  TertiaryButton,
} from "../components/buttons";
import { useToast } from "../components/Toast";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";
import { useProductsQuery } from "../lib/queries/products";
import { useSubFeaturesForProductQuery } from "../lib/queries/subFeatures";
import {
  useProductQuestionsQuery,
  useSubFeatureQuestionsQuery,
} from "../lib/queries/questions";
import {
  useProductTemplateQuery,
  useSubFeatureTemplateQuery,
} from "../lib/queries/templates";
import {
  useCreateDraftMutation,
  useDiscardDraftMutation,
  useMyRequestQuery,
  useSaveDraftAnswersMutation,
  useSubmitRequestMutation,
  useUpdateDraftMutation,
} from "../lib/queries/estimates";
import type { ProductDetail, ProductMode } from "../lib/api/products";
import type { QuestionListItem } from "../lib/api/questions";
import type { TemplateView } from "../lib/api/templates";

const STEPS = ["Choose product", "Answer questions", "Review & submit"];

type Step = 1 | 2 | 3;

function clampStep(raw: string | null): Step {
  const n = raw ? Number(raw) : 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

export function NewEstimateRequestPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const urlStep = clampStep(params.get("step"));
  const urlId = params.get("id") ? Number(params.get("id")) : null;

  // Hydrate from existing Draft when ?id= is present (resume from
  // EstimateDetailPage's "Edit answers" link, or browser refresh).
  const existingQuery = useMyRequestQuery(urlId);

  // Local form state. Initial values mirror the Draft once loaded; Step 1
  // edits stay local until "Save as draft" / "Continue".
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const [subFeatureId, setSubFeatureId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(urlId);
  const [savedFlash, setSavedFlash] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  // The product is locked once the Draft exists — once chosen, switching
  // would invalidate the answers. The picker disables when draftId is set.
  const productLocked = draftId != null;

  // Sync local state from server-loaded Draft once on first hydration.
  useEffect(() => {
    if (!urlId || !existingQuery.data) return;
    const d = existingQuery.data;
    setTitle(d.title);
    setDescription(d.description ?? "");
    setProductId(d.productId);
    setSubFeatureId(d.subFeatureId ?? null);
    const next: Record<number, string> = {};
    for (const a of d.answers) next[a.questionId] = a.answerText ?? "";
    setAnswers(next);
    setDirty(false);
    setDraftId(d.id);
    // Intentionally only depends on the loaded shape — the form is the
    // edit surface from here on, no further hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingQuery.data?.id]);

  useEffect(() => {
    document.title = "New estimate request — Estimator";
  }, []);

  // SPA-side: block tab close / refresh when the form is dirty. SPA
  // navigation guard is the same gap documented on Phase 5b.
  useUnsavedChangesGuard(dirty);

  // Active products only.
  const productsQuery = useProductsQuery({ status: "ACTIVE", size: 100 });
  const products = productsQuery.data?.items ?? [];
  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const isContainer = selectedProduct?.mode === "CONTAINER";

  // Sub-features for container products.
  const subFeaturesQuery = useSubFeaturesForProductQuery(
    isContainer ? productId : null,
  );
  const subFeatures = subFeaturesQuery.data ?? [];
  const activeSubFeatures = subFeatures.filter((s) => s.active);

  // Active template + questions resolve from product OR sub-feature.
  const templateProductQuery = useProductTemplateQuery(
    selectedProduct && !isContainer ? productId : null,
  );
  const templateSubFeatureQuery = useSubFeatureTemplateQuery(
    isContainer && subFeatureId ? subFeatureId : null,
  );
  const template: TemplateView | null =
    (isContainer
      ? templateSubFeatureQuery.data
      : templateProductQuery.data) ?? null;

  const productQuestionsQuery = useProductQuestionsQuery(
    selectedProduct && !isContainer ? productId : null,
  );
  const subFeatureQuestionsQuery = useSubFeatureQuestionsQuery(
    isContainer && subFeatureId ? subFeatureId : null,
  );
  const questions: QuestionListItem[] = useMemo(() => {
    const raw = isContainer
      ? subFeatureQuestionsQuery.data
      : productQuestionsQuery.data;
    return (raw ?? []).filter((q) => q.active);
  }, [isContainer, productQuestionsQuery.data, subFeatureQuestionsQuery.data]);

  // Mutations.
  const createMutation = useCreateDraftMutation();
  const updateMutation = useUpdateDraftMutation();
  const saveAnswersMutation = useSaveDraftAnswersMutation();
  const submitMutation = useSubmitRequestMutation();
  const discardMutation = useDiscardDraftMutation();

  const step: Step = urlStep;
  // If urlId is set but step=1 was requested AND the Draft has no
  // answers, allow it — the user explicitly came back to edit Step 1.
  // If urlId is absent and step > 1, redirect to step 1 (no Draft to edit).
  useEffect(() => {
    if (!urlId && urlStep > 1) {
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.set("step", "1");
        return next;
      }, { replace: true });
    }
  }, [urlId, urlStep, setParams]);

  function setStep(next: Step, idOverride?: number | null) {
    setParams((p) => {
      const u = new URLSearchParams(p);
      u.set("step", String(next));
      const id = idOverride ?? draftId;
      if (id != null) u.set("id", String(id));
      return u;
    });
  }

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function ensureDraftThen(advanceTo?: Step) {
    if (!productId) {
      toast.error("Pick a product first.");
      return;
    }
    if (isContainer && !subFeatureId) {
      toast.error("Container products need a sub-feature.");
      return;
    }
    try {
      let id = draftId;
      if (id == null) {
        const created = await createMutation.mutateAsync({
          title: title.trim(),
          productId,
          subFeatureId: isContainer ? subFeatureId : null,
          description: description.trim() || null,
        });
        id = created.id;
        setDraftId(id);
      } else {
        await updateMutation.mutateAsync({
          id,
          body: {
            title: title.trim(),
            description: description.trim() || null,
          },
        });
      }
      setDirty(false);
      if (advanceTo) setStep(advanceTo, id);
      else flashSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the draft.");
    }
  }

  async function persistAnswers(advanceTo?: Step) {
    if (draftId == null) {
      toast.error("Save the draft first.");
      return;
    }
    try {
      await saveAnswersMutation.mutateAsync({
        id: draftId,
        body: {
          answers: Object.entries(answers)
            .map(([qid, text]) => ({
              questionId: Number(qid),
              answerText: text,
            }))
            // Drop blank answers — the backend ignores them anyway.
            .filter((a) => a.answerText.trim() !== ""),
        },
      });
      setDirty(false);
      if (advanceTo) setStep(advanceTo);
      else flashSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save answers.");
    }
  }

  async function performSubmit() {
    if (draftId == null) return;
    try {
      // Defensive: re-PUT answers in case the user edited Step 2 then
      // jumped to Step 3 without explicitly saving.
      await saveAnswersMutation.mutateAsync({
        id: draftId,
        body: {
          answers: Object.entries(answers)
            .map(([qid, text]) => ({
              questionId: Number(qid),
              answerText: text,
            }))
            .filter((a) => a.answerText.trim() !== ""),
        },
      });
      const submitted = await submitMutation.mutateAsync(draftId);
      toast.success("Request submitted. The Solution Owner team will review your request.");
      navigate(`/requests/${submitted.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the request.");
    } finally {
      setSubmitOpen(false);
    }
  }

  function handleCancel() {
    setCancelOpen(true);
  }

  async function performCancel() {
    if (draftId != null) {
      try {
        await discardMutation.mutateAsync(draftId);
        toast.success("Draft discarded.");
      } catch {
        toast.error("Could not discard the draft.");
      }
    }
    setCancelOpen(false);
    navigate("/requests");
  }

  // Required-question coverage for Step 2's Continue button.
  const requiredQuestionIds = questions.filter((q) => q.required).map((q) => q.id);
  const allRequiredAnswered = requiredQuestionIds.every(
    (qid) => (answers[qid] ?? "").trim() !== "",
  );

  // Show "no template" warning + lock the flow at step 1.
  // The product picker is loaded; the template fetch returned null →
  // there's no active template, so submission would 409 with NO_ACTIVE_TEMPLATE.
  const templateLoaded = isContainer
    ? subFeatureId != null && !templateSubFeatureQuery.isLoading
    : selectedProduct != null && !isContainer && !templateProductQuery.isLoading;
  const noTemplate = templateLoaded && template == null;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Workspace" },
          { label: "Estimate requests", to: "/requests" },
          { label: "New" },
        ]}
        title="New estimate request"
        subtitle="Three steps. Pick a product, answer the critical questions, review and submit."
      />

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <Stepper steps={STEPS} currentStep={step - 1} />
      </div>

      {step === 1 && (
        <Step1
          title={title}
          description={description}
          productId={productId}
          subFeatureId={subFeatureId}
          products={products}
          selectedProduct={selectedProduct}
          activeSubFeatures={activeSubFeatures}
          template={template}
          questions={questions}
          noTemplate={noTemplate}
          productLocked={productLocked}
          onTitleChange={(v) => { setTitle(v); setDirty(true); }}
          onDescriptionChange={(v) => { setDescription(v); setDirty(true); }}
          onProductChange={(id) => {
            setProductId(id);
            setSubFeatureId(null);
            setDirty(true);
          }}
          onSubFeatureChange={(id) => {
            setSubFeatureId(id);
            setDirty(true);
          }}
          savedFlash={savedFlash}
          saving={createMutation.isPending || updateMutation.isPending}
          onCancel={handleCancel}
          onSaveDraft={() => void ensureDraftThen()}
          onContinue={() => void ensureDraftThen(2)}
          continueDisabled={
            title.trim() === "" ||
            productId == null ||
            (isContainer && subFeatureId == null) ||
            noTemplate
          }
        />
      )}

      {step === 2 && (
        <Step2
          questions={questions}
          answers={answers}
          onAnswerChange={(qid, value) => {
            setAnswers((prev) => ({ ...prev, [qid]: value }));
            setDirty(true);
          }}
          allRequiredAnswered={allRequiredAnswered}
          savedFlash={savedFlash}
          saving={saveAnswersMutation.isPending}
          onBack={() => setStep(1)}
          onSaveDraft={() => void persistAnswers()}
          onContinue={() => void persistAnswers(3)}
        />
      )}

      {step === 3 && (
        <Step3
          title={title}
          description={description}
          productName={selectedProduct?.name ?? ""}
          subFeatureName={
            isContainer
              ? activeSubFeatures.find((s) => s.id === subFeatureId)?.name ?? ""
              : null
          }
          template={template}
          questions={questions}
          answers={answers}
          submitting={submitMutation.isPending || saveAnswersMutation.isPending}
          onBack={() => setStep(2)}
          onSaveDraft={() => void persistAnswers()}
          onSubmit={() => setSubmitOpen(true)}
        />
      )}

      <ConfirmModal
        open={cancelOpen}
        title={draftId == null ? "Discard this request?" : "Discard this draft?"}
        body={
          <p className="text-body text-warm-gray-med m-0">
            {draftId == null
              ? "Your draft hasn't been saved. You'll lose what you've entered."
              : "This draft will be permanently deleted. This can't be undone."}
          </p>
        }
        confirmLabel={draftId == null ? "Discard" : "Discard draft"}
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setCancelOpen(false)}
        onConfirm={performCancel}
      />

      <ConfirmModal
        open={submitOpen}
        title="Submit this request?"
        body={
          <p className="text-body text-warm-gray-med m-0">
            After submission you can't change the answers without the Solution
            Owner sending it back.
          </p>
        }
        // Modal confirm reads as a confirmation of the action, not a
        // re-statement of the trigger button. Distinct label also keeps
        // the page tests' `getByRole("button", { name: ... })` queries
        // unambiguous.
        confirmLabel="Submit"
        cancelLabel="Keep editing"
        onCancel={() => setSubmitOpen(false)}
        onConfirm={performSubmit}
      />
    </>
  );
}

// =====================================================================
// Step 1 — Choose product
// =====================================================================

interface Step1Props {
  title: string;
  description: string;
  productId: number | null;
  subFeatureId: number | null;
  products: ProductDetail[];
  selectedProduct: ProductDetail | null;
  activeSubFeatures: { id: number; name: string }[];
  template: TemplateView | null;
  questions: QuestionListItem[];
  noTemplate: boolean;
  productLocked: boolean;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onProductChange: (id: number | null) => void;
  onSubFeatureChange: (id: number | null) => void;
  savedFlash: boolean;
  saving: boolean;
  onCancel: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
}

function Step1({
  title,
  description,
  productId,
  subFeatureId,
  products,
  selectedProduct,
  activeSubFeatures,
  template,
  questions,
  noTemplate,
  productLocked,
  onTitleChange,
  onDescriptionChange,
  onProductChange,
  onSubFeatureChange,
  savedFlash,
  saving,
  onCancel,
  onSaveDraft,
  onContinue,
  continueDisabled,
}: Step1Props) {
  const isContainer = selectedProduct?.mode === "CONTAINER";

  return (
    <Card>
      <div className="flex flex-col" style={{ gap: 16 }}>
        <TextInput
          id="request-title"
          label="What should this estimate be called?"
          helper="A short name you'll use to find this later, e.g. 'Member Portal v2'."
          value={title}
          onChange={(e) => onTitleChange(e.currentTarget.value)}
          maxLength={255}
          required
        />
        <Textarea
          id="request-description"
          label="Description"
          helper="Background or context the reviewer should know."
          rows={3}
          value={description}
          onChange={(e) => onDescriptionChange(e.currentTarget.value)}
          maxLength={4000}
        />
        <div>
          <label
            htmlFor="product-picker"
            className="block text-near-black font-medium"
            style={{ fontSize: 13, marginBottom: 6 }}
          >
            Product <span className="text-cardinal-red">*</span>
          </label>
          {/*
            Native <select> is a deliberate temporary choice. The Phase 6a
            prompt called for a "combobox (search-as-you-type)", but we
            don't have a generic Combobox component yet and building one
            well costs ~half a milestone. Native typeahead-on-select
            handles the small catalog sizes Phase 6a ships with.

            UPGRADE TRIGGER: when the active product list grows past ~50
            entries (or when sub-feature lists for any container product
            do), swap for a real Combobox component. Same swap on
            <select id="subfeature-picker"> below — both pickers should
            move together so the surface stays consistent.
          */}
          <select
            id="product-picker"
            value={productId ?? ""}
            disabled={productLocked}
            onChange={(e) =>
              onProductChange(e.currentTarget.value ? Number(e.currentTarget.value) : null)
            }
            className="w-full rounded-md border border-border bg-white text-body text-near-black h-8 px-2 disabled:bg-warm-gray-light disabled:text-warm-gray-med"
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({modeLabel(p.mode)})
              </option>
            ))}
          </select>
          {productLocked && (
            <p className="m-0 mt-1 text-warm-gray-med" style={{ fontSize: 12 }}>
              Locked once the draft was saved — start a new request to switch products.
            </p>
          )}
        </div>
        {isContainer && (
          <div>
            <label
              htmlFor="subfeature-picker"
              className="block text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 6 }}
            >
              Sub-feature <span className="text-cardinal-red">*</span>
            </label>
            <select
              id="subfeature-picker"
              value={subFeatureId ?? ""}
              disabled={productLocked}
              onChange={(e) =>
                onSubFeatureChange(e.currentTarget.value ? Number(e.currentTarget.value) : null)
              }
              className="w-full rounded-md border border-border bg-white text-body text-near-black h-8 px-2 disabled:bg-warm-gray-light disabled:text-warm-gray-med"
            >
              <option value="">Select a sub-feature…</option>
              {activeSubFeatures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {activeSubFeatures.length === 0 && (
              <p className="m-0 mt-1 text-warm-gray-med" style={{ fontSize: 12 }}>
                This container product has no active sub-features yet.
              </p>
            )}
          </div>
        )}

        {/* Template preview / no-template warning. Only renders once a
            valid parent (product or sub-feature) is chosen. */}
        {selectedProduct && (!isContainer || subFeatureId != null) && (
          <TemplatePreview
            template={template}
            noTemplate={noTemplate}
            questionCount={questions.length}
          />
        )}
      </div>

      <FooterRow>
        <TertiaryButton onClick={onCancel}>Cancel</TertiaryButton>
        <SecondaryButton
          disabled={saving || title.trim() === "" || productId == null || (isContainer && subFeatureId == null)}
          onClick={onSaveDraft}
        >
          {savedFlash ? "Saved as draft" : "Save as draft"}
        </SecondaryButton>
        <PrimaryButton disabled={continueDisabled || saving} onClick={onContinue}>
          Continue to questions
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PrimaryButton>
      </FooterRow>
    </Card>
  );
}

function TemplatePreview({
  template,
  noTemplate,
  questionCount,
}: {
  template: TemplateView | null;
  noTemplate: boolean;
  questionCount: number;
}) {
  if (noTemplate) {
    return (
      <div
        className="rounded-md"
        style={{
          background: "var(--color-light-blue-soft)",
          padding: "10px 12px",
          border: "1px solid rgba(187,221,230,0.7)",
          fontSize: 13,
          color: "var(--fg-1)",
        }}
        role="alert"
      >
        This product doesn't have an active estimate template yet. The Solution
        Owner needs to create one before estimates can be submitted.
      </div>
    );
  }
  if (!template) return null;
  return (
    <div
      className="rounded-md"
      style={{
        background: "#FBFBFA",
        padding: "10px 12px",
        border: "1px solid var(--color-warm-gray-light)",
        fontSize: 13,
        color: "var(--fg-1)",
      }}
    >
      <strong>Estimate template:</strong> {template.displayName.replace("Estimate template for ", "")}
      <span className="text-warm-gray-med">
        {" "}· {questionCount} {questionCount === 1 ? "question" : "questions"} to answer
      </span>
    </div>
  );
}

// =====================================================================
// Step 2 — Answer questions
// =====================================================================

interface Step2Props {
  questions: QuestionListItem[];
  answers: Record<number, string>;
  onAnswerChange: (qid: number, value: string) => void;
  allRequiredAnswered: boolean;
  savedFlash: boolean;
  saving: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
}

function Step2({
  questions,
  answers,
  onAnswerChange,
  allRequiredAnswered,
  savedFlash,
  saving,
  onBack,
  onSaveDraft,
  onContinue,
}: Step2Props) {
  return (
    <Card>
      {questions.length === 0 ? (
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 14 }}>
          No questions for this product. Continue to review.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 18 }}>
          {questions.map((q) => (
            <li key={q.id}>
              <div className="flex items-baseline" style={{ gap: 8, marginBottom: 4 }}>
                <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>
                  {q.questionText}
                </span>
                {q.required && <RequiredPill />}
              </div>
              {q.helpText && (
                <p className="m-0 mb-1 text-warm-gray-med" style={{ fontSize: 12 }}>
                  {q.helpText}
                </p>
              )}
              <Textarea
                id={`answer-${q.id}`}
                value={answers[q.id] ?? ""}
                onChange={(e) => onAnswerChange(q.id, e.currentTarget.value)}
                maxLength={8000}
                rows={3}
                aria-label={`Answer to: ${q.questionText}`}
              />
            </li>
          ))}
        </ul>
      )}

      <FooterRow>
        <TertiaryButton onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back
        </TertiaryButton>
        <SecondaryButton disabled={saving} onClick={onSaveDraft}>
          {savedFlash ? "Saved as draft" : "Save as draft"}
        </SecondaryButton>
        <PrimaryButton
          disabled={saving || (questions.length > 0 && !allRequiredAnswered)}
          onClick={onContinue}
        >
          Continue to review
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PrimaryButton>
      </FooterRow>
    </Card>
  );
}

// =====================================================================
// Step 3 — Review & submit
// =====================================================================

interface Step3Props {
  title: string;
  description: string;
  productName: string;
  subFeatureName: string | null;
  template: TemplateView | null;
  questions: QuestionListItem[];
  answers: Record<number, string>;
  submitting: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

function Step3({
  title,
  description,
  productName,
  subFeatureName,
  template,
  questions,
  answers,
  submitting,
  onBack,
  onSaveDraft,
  onSubmit,
}: Step3Props) {
  return (
    <Card>
      <div className="flex flex-col" style={{ gap: 18 }}>
        <Section label="Title">
          <strong>{title}</strong>
        </Section>
        {description && <Section label="Description">{description}</Section>}
        <Section label="Product">
          {productName}
          {subFeatureName && <> · {subFeatureName}</>}
          {template && (
            <span className="text-warm-gray-med">
              {" "}· Active template: v{template.versionNumber}
            </span>
          )}
        </Section>

        <div>
          <SectionLabel>Critical questions</SectionLabel>
          {questions.length === 0 ? (
            <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
              No questions on this product.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 12 }}>
              {questions.map((q) => {
                const a = answers[q.id]?.trim() ?? "";
                return (
                  <li key={q.id}>
                    <div className="text-near-black font-semibold" style={{ fontSize: 14 }}>
                      {q.questionText}
                    </div>
                    <p
                      className="m-0 mt-1"
                      style={{
                        fontSize: 14,
                        color: a ? "var(--fg-1)" : "var(--color-warm-gray-med)",
                        fontStyle: a ? undefined : "italic",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {a || "Not answered"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className="rounded-md"
          style={{
            background: "var(--color-light-blue-soft)",
            padding: "10px 12px",
            border: "1px solid rgba(187,221,230,0.7)",
            fontSize: 13,
            color: "var(--fg-1)",
          }}
        >
          <strong>What happens next:</strong> When you submit, this request locks
          the current template values. The Solution Owner will review the
          questions, choose complexity, and approve. You'll be notified when
          it's ready.
        </div>
      </div>

      <FooterRow>
        <TertiaryButton onClick={onBack}>
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back
        </TertiaryButton>
        <SecondaryButton disabled={submitting} onClick={onSaveDraft}>
          Save as draft
        </SecondaryButton>
        <PrimaryButton disabled={submitting} onClick={onSubmit}>
          Submit for review
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PrimaryButton>
      </FooterRow>
    </Card>
  );
}

// =====================================================================
// Local UI helpers
// =====================================================================

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="bg-white rounded-lg"
      style={{
        border: "1px solid var(--color-warm-gray-light)",
        padding: "18px 20px 20px",
      }}
    >
      {children}
    </section>
  );
}

function FooterRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-end"
      style={{
        gap: 8,
        marginTop: 24,
        paddingTop: 16,
        borderTop: "1px solid var(--color-warm-gray-light)",
      }}
    >
      {children}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="text-near-black mt-1" style={{ fontSize: 14 }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-warm-gray-med uppercase font-medium"
      style={{ fontSize: 11, letterSpacing: "0.04em" }}
    >
      {children}
    </div>
  );
}

function RequiredPill() {
  return (
    <span
      className="inline-flex items-center text-near-black"
      style={{
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border-strong)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      Required
    </span>
  );
}

function modeLabel(mode: ProductMode): string {
  return mode === "ATOMIC" ? "atomic" : "container";
}

// Use the unused PageHeader import marker if-needed; React doesn't support
// "import for side effect" in this case, so we just rely on the component
// being referenced. (kept import — used above.)
void Plus;
