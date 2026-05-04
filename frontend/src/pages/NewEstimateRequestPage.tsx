import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Minus, Plus, X } from "lucide-react";
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
  useCreateDraftMutation,
  useDiscardDraftMutation,
  useMyRequestQuery,
  useSaveDraftItemAnswersMutation,
  useSubmitRequestMutation,
  useUpdateDraftMutation,
} from "../lib/queries/estimates";
import type { ProductDetail, ProductMode } from "../lib/api/products";
import type { QuestionListItem } from "../lib/api/questions";

// Silence unused imports that are referenced transitively or kept for future use
void useProductQuestionsQuery;
void useSubFeatureQuestionsQuery;

const STEPS = ["Choose products", "Answer questions", "Review & submit"];

type Step = 1 | 2 | 3;

function clampStep(raw: string | null): Step {
  const n = raw ? Number(raw) : 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

type LocalItem = {
  productId: number;
  productName: string;
  subFeatureId: number | null;
  subFeatureName: string | null;
  itemId: number | null;
  answers: Record<number, string>;
};

export function NewEstimateRequestPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const urlStep = clampStep(params.get("step"));
  const urlId = params.get("id") ? Number(params.get("id")) : null;

  const existingQuery = useMyRequestQuery(urlId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [pendingProductId, setPendingProductId] = useState<number | null>(null);
  const [pendingSubFeatureId, setPendingSubFeatureId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(urlId);
  const [savedFlash, setSavedFlash] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [itemsReady, setItemsReady] = useState<boolean[]>([]);

  const itemsLocked = draftId != null;

  // Sync from loaded draft
  useEffect(() => {
    if (!urlId || !existingQuery.data) return;
    const d = existingQuery.data;
    setTitle(d.title);
    setDescription(d.description ?? "");
    const hydrated = d.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      subFeatureId: item.subFeatureId,
      subFeatureName: item.subFeatureName,
      itemId: item.id,
      answers: item.answers.reduce(
        (acc, a) => ({ ...acc, [a.questionId]: a.answerText }),
        {} as Record<number, string>,
      ),
    }));
    setLocalItems(hydrated);
    setDirty(false);
    setDraftId(d.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingQuery.data?.id]);

  useEffect(() => {
    document.title = "New estimate request — Estimator";
  }, []);

  useUnsavedChangesGuard(dirty);

  const productsQuery = useProductsQuery({ status: "ACTIVE", size: 100 });
  const products = productsQuery.data?.items ?? [];

  const pendingProduct = products.find((p) => p.id === pendingProductId) ?? null;
  const pendingIsContainer = pendingProduct?.mode === "CONTAINER";
  const subFeaturesQuery = useSubFeaturesForProductQuery(
    pendingIsContainer ? pendingProductId : null,
  );
  const pendingSubFeatures = (subFeaturesQuery.data ?? []).filter((s) => s.active);

  const createMutation = useCreateDraftMutation();
  const updateMutation = useUpdateDraftMutation();
  const saveItemAnswersMutation = useSaveDraftItemAnswersMutation();
  const submitMutation = useSubmitRequestMutation();
  const discardMutation = useDiscardDraftMutation();

  const step: Step = urlStep;

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

  function addPendingItem() {
    if (!pendingProductId || !pendingProduct) return;
    if (pendingIsContainer && !pendingSubFeatureId) return;
    const subFeature = pendingIsContainer
      ? pendingSubFeatures.find((s) => s.id === pendingSubFeatureId) ?? null
      : null;
    const newItem: LocalItem = {
      productId: pendingProductId,
      productName: pendingProduct.name,
      subFeatureId: pendingIsContainer ? pendingSubFeatureId : null,
      subFeatureName: subFeature?.name ?? null,
      itemId: null,
      answers: {},
    };
    setLocalItems((prev) => [...prev, newItem]);
    setPendingProductId(null);
    setPendingSubFeatureId(null);
    setDirty(true);
  }

  function removeItem(index: number) {
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  async function ensureDraftThen(advanceTo?: Step) {
    if (localItems.length === 0) {
      toast.error("Add at least one product first.");
      return;
    }
    try {
      let id = draftId;
      if (id == null) {
        const created = await createMutation.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          items: localItems.map((item) => ({
            productId: item.productId,
            subFeatureId: item.subFeatureId ?? null,
          })),
        });
        id = created.id;
        setDraftId(id);
        setLocalItems((prev) =>
          prev.map((item, i) => ({ ...item, itemId: created.items[i]?.id ?? null }))
        );
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

  async function persistAllAnswers(advanceTo?: Step) {
    if (draftId == null) {
      toast.error("Save the draft first.");
      return;
    }
    try {
      for (const item of localItems) {
        if (item.itemId == null) continue;
        const answersToSave = Object.entries(item.answers)
          .map(([qid, text]) => ({ questionId: Number(qid), answerText: text }))
          .filter((a) => a.answerText.trim() !== "");
        await saveItemAnswersMutation.mutateAsync({
          id: draftId,
          itemId: item.itemId,
          body: { answers: answersToSave },
        });
      }
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
      await persistAllAnswers();
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

  const handleItemReadyChange = useCallback((index: number, ready: boolean) => {
    setItemsReady((prev) => {
      const next = [...prev];
      next[index] = ready;
      return next;
    });
  }, []);

  const handleItemAnswerChange = useCallback((itemIndex: number, qid: number, value: string) => {
    setLocalItems((prev) => {
      const next = [...prev];
      next[itemIndex] = { ...next[itemIndex], answers: { ...next[itemIndex].answers, [qid]: value } };
      return next;
    });
    setDirty(true);
  }, []);

  const allItemsReady = itemsReady.length === localItems.length &&
    localItems.length > 0 &&
    itemsReady.every(Boolean);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Workspace" },
          { label: "Estimate requests", to: "/requests" },
          { label: "New" },
        ]}
        title="New estimate request"
        subtitle="Three steps. Pick your products, answer the critical questions, review and submit."
      />

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <Stepper steps={STEPS} currentStep={step - 1} />
      </div>

      {step === 1 && (
        <Step1
          title={title}
          description={description}
          localItems={localItems}
          pendingProductId={pendingProductId}
          pendingSubFeatureId={pendingSubFeatureId}
          products={products}
          pendingProduct={pendingProduct}
          pendingSubFeatures={pendingSubFeatures}
          itemsLocked={itemsLocked}
          savedFlash={savedFlash}
          saving={createMutation.isPending || updateMutation.isPending}
          onTitleChange={(v) => { setTitle(v); setDirty(true); }}
          onDescriptionChange={(v) => { setDescription(v); setDirty(true); }}
          onPendingProductChange={(id) => {
            setPendingProductId(id);
            setPendingSubFeatureId(null);
          }}
          onPendingSubFeatureChange={setPendingSubFeatureId}
          onAddItem={addPendingItem}
          onRemoveItem={removeItem}
          onCancel={handleCancel}
          onSaveDraft={() => void ensureDraftThen()}
          onContinue={() => void ensureDraftThen(2)}
          continueDisabled={
            title.trim() === "" ||
            localItems.length === 0
          }
        />
      )}

      {step === 2 && (
        <Step2
          localItems={localItems}
          products={products}
          draftId={draftId}
          savedFlash={savedFlash}
          saving={saveItemAnswersMutation.isPending}
          allItemsReady={allItemsReady}
          onItemAnswerChange={handleItemAnswerChange}
          onItemReadyChange={handleItemReadyChange}
          onBack={() => setStep(1)}
          onSaveDraft={() => void persistAllAnswers()}
          onContinue={() => void persistAllAnswers(3)}
        />
      )}

      {step === 3 && (
        <Step3
          title={title}
          description={description}
          localItems={localItems}
          products={products}
          submitting={submitMutation.isPending || saveItemAnswersMutation.isPending}
          onBack={() => setStep(2)}
          onSaveDraft={() => void persistAllAnswers()}
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
        confirmLabel="Submit"
        cancelLabel="Keep editing"
        onCancel={() => setSubmitOpen(false)}
        onConfirm={performSubmit}
      />
    </>
  );
}

// =====================================================================
// Step 1 — Choose products
// =====================================================================

interface Step1Props {
  title: string;
  description: string;
  localItems: LocalItem[];
  pendingProductId: number | null;
  pendingSubFeatureId: number | null;
  products: ProductDetail[];
  pendingProduct: ProductDetail | null;
  pendingSubFeatures: { id: number; name: string }[];
  itemsLocked: boolean;
  savedFlash: boolean;
  saving: boolean;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onPendingProductChange: (id: number | null) => void;
  onPendingSubFeatureChange: (id: number | null) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
}

function Step1({
  title,
  description,
  localItems,
  pendingProductId,
  pendingSubFeatureId,
  products,
  pendingProduct,
  pendingSubFeatures,
  itemsLocked,
  savedFlash,
  saving,
  onTitleChange,
  onDescriptionChange,
  onPendingProductChange,
  onPendingSubFeatureChange,
  onAddItem,
  onRemoveItem,
  onCancel,
  onSaveDraft,
  onContinue,
  continueDisabled,
}: Step1Props) {
  const pendingIsContainer = pendingProduct?.mode === "CONTAINER";
  const addDisabled =
    itemsLocked ||
    pendingProductId == null ||
    (pendingIsContainer && pendingSubFeatureId == null);

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

        {/* Selected products list */}
        {localItems.length > 0 && (
          <div>
            <div
              className="text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 8 }}
            >
              Selected products
            </div>
            <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 6 }}>
              {localItems.map((item, i) => (
                <li
                  key={`${item.productId}-${item.subFeatureId ?? "null"}-${i}`}
                  className="flex items-center justify-between rounded-md"
                  style={{
                    padding: "8px 10px",
                    background: "#FBFBFA",
                    border: "1px solid var(--color-warm-gray-light)",
                    fontSize: 13,
                  }}
                >
                  <span className="text-near-black">
                    {item.productName}
                    {item.subFeatureName && (
                      <span className="text-warm-gray-med"> · {item.subFeatureName}</span>
                    )}
                  </span>
                  {!itemsLocked && (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(i)}
                      aria-label={`Remove ${item.productName}`}
                      className="inline-flex items-center justify-center bg-transparent border-0 cursor-pointer text-warm-gray-med hover:text-near-black"
                      style={{ padding: 2 }}
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add product row */}
        {!itemsLocked && (
          <div>
            <div
              className="text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 6 }}
            >
              {localItems.length === 0 ? (
                <>Product <span className="text-cardinal-red">*</span></>
              ) : (
                "Add another product"
              )}
            </div>
            <div className="flex items-end" style={{ gap: 8 }}>
              <div style={{ flex: 1 }}>
                <select
                  id="product-picker"
                  aria-label="Product"
                  value={pendingProductId ?? ""}
                  onChange={(e) =>
                    onPendingProductChange(e.currentTarget.value ? Number(e.currentTarget.value) : null)
                  }
                  className="w-full rounded-md border border-border bg-white text-body text-near-black h-8 px-2"
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({modeLabel(p.mode)})
                    </option>
                  ))}
                </select>
              </div>
              {pendingIsContainer && (
                <div style={{ flex: 1 }}>
                  <label
                    htmlFor="subfeature-picker"
                    className="block text-near-black font-medium"
                    style={{ fontSize: 13, marginBottom: 6 }}
                  >
                    Sub-feature <span className="text-cardinal-red">*</span>
                  </label>
                  <select
                    id="subfeature-picker"
                    value={pendingSubFeatureId ?? ""}
                    onChange={(e) =>
                      onPendingSubFeatureChange(
                        e.currentTarget.value ? Number(e.currentTarget.value) : null,
                      )
                    }
                    className="w-full rounded-md border border-border bg-white text-body text-near-black h-8 px-2"
                  >
                    <option value="">Select a sub-feature…</option>
                    {pendingSubFeatures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <SecondaryButton
                disabled={addDisabled}
                onClick={onAddItem}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                Add
              </SecondaryButton>
            </div>
          </div>
        )}

        {itemsLocked && localItems.length > 0 && (
          <p className="m-0 text-warm-gray-med" style={{ fontSize: 12 }}>
            Products are locked once the draft is saved — start a new request to change the product list.
          </p>
        )}
      </div>

      <FooterRow>
        <TertiaryButton onClick={onCancel}>Cancel</TertiaryButton>
        <SecondaryButton
          disabled={saving || title.trim() === "" || localItems.length === 0}
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

// =====================================================================
// Step 2 — Answer questions (per-item accordion)
// =====================================================================

interface Step2Props {
  localItems: LocalItem[];
  products: ProductDetail[];
  draftId: number | null;
  savedFlash: boolean;
  saving: boolean;
  allItemsReady: boolean;
  onItemAnswerChange: (itemIndex: number, qid: number, value: string) => void;
  onItemReadyChange: (itemIndex: number, ready: boolean) => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
}

function Step2({
  localItems,
  products,
  savedFlash,
  saving,
  allItemsReady,
  onItemAnswerChange,
  onItemReadyChange,
  onBack,
  onSaveDraft,
  onContinue,
}: Step2Props) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <Card>
      {localItems.length === 0 ? (
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 14 }}>
          No products selected.
        </p>
      ) : (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {localItems.map((item, i) => {
            const product = products.find((p) => p.id === item.productId) ?? null;
            return (
              <ItemSection
                key={`${item.productId}-${item.subFeatureId ?? "null"}-${i}`}
                item={item}
                product={product}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
                onAnswerChange={(qid, value) => onItemAnswerChange(i, qid, value)}
                onReadyChange={(ready) => onItemReadyChange(i, ready)}
              />
            );
          })}
        </div>
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
          disabled={saving || !allItemsReady}
          onClick={onContinue}
        >
          Continue to review
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PrimaryButton>
      </FooterRow>
    </Card>
  );
}

interface ItemSectionProps {
  item: LocalItem;
  product: ProductDetail | null;
  isOpen: boolean;
  onToggle: () => void;
  onAnswerChange: (qid: number, value: string) => void;
  onReadyChange: (ready: boolean) => void;
}

function ItemSection({
  item,
  product,
  isOpen,
  onToggle,
  onAnswerChange,
  onReadyChange,
}: ItemSectionProps) {
  const isContainer = product?.mode === "CONTAINER";

  const productQuestionsQuery = useProductQuestionsQuery(
    !isContainer ? item.productId : null,
  );
  const subFeatureQuestionsQuery = useSubFeatureQuestionsQuery(
    isContainer && item.subFeatureId ? item.subFeatureId : null,
  );
  const questions: QuestionListItem[] = useMemo(() => {
    const raw = isContainer
      ? subFeatureQuestionsQuery.data
      : productQuestionsQuery.data;
    return (raw ?? []).filter((q) => q.active);
  }, [isContainer, productQuestionsQuery.data, subFeatureQuestionsQuery.data]);

  const requiredIds = questions.filter((q) => q.required).map((q) => q.id);
  const allRequiredAnswered = requiredIds.every(
    (qid) => (item.answers[qid] ?? "").trim() !== "",
  );

  useEffect(() => {
    onReadyChange(requiredIds.length === 0 || allRequiredAnswered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRequiredAnswered, requiredIds.length]);

  const heading = item.subFeatureName
    ? `${item.productName} · ${item.subFeatureName}`
    : item.productName;

  return (
    <div
      className="rounded-md"
      style={{ border: "1px solid var(--color-warm-gray-light)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between bg-transparent border-0 cursor-pointer text-left"
        style={{
          padding: "10px 14px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--fg-1)",
          background: isOpen ? "#FBFBFA" : "#FFFFFF",
          borderRadius: isOpen ? "6px 6px 0 0" : 6,
        }}
      >
        <span>{heading}</span>
        <span className="flex items-center" style={{ gap: 8 }}>
          {questions.length > 0 && (
            <span className="text-warm-gray-med" style={{ fontSize: 12, fontWeight: 400 }}>
              {questions.length} {questions.length === 1 ? "question" : "questions"}
            </span>
          )}
          {isOpen
            ? <Minus className="w-3.5 h-3.5 text-warm-gray-med" strokeWidth={1.5} />
            : <Plus className="w-3.5 h-3.5 text-warm-gray-med" strokeWidth={1.5} />
          }
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--color-warm-gray-light)" }}>
          {questions.length === 0 ? (
            <p className="m-0 text-warm-gray-med" style={{ fontSize: 14 }}>
              No questions for this product.
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
                    id={`answer-${item.productId}-${item.subFeatureId ?? "null"}-${q.id}`}
                    value={item.answers[q.id] ?? ""}
                    onChange={(e) => onAnswerChange(q.id, e.currentTarget.value)}
                    maxLength={8000}
                    rows={3}
                    aria-label={`Answer to: ${q.questionText}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Step 3 — Review & submit
// =====================================================================

interface Step3Props {
  title: string;
  description: string;
  localItems: LocalItem[];
  products: ProductDetail[];
  submitting: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

function Step3({
  title,
  description,
  localItems,
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

        <div>
          <SectionLabel>Products ({localItems.length})</SectionLabel>
          <ul className="m-0 p-0 list-none flex flex-col mt-2" style={{ gap: 14 }}>
            {localItems.map((item, i) => (
              <ItemSummary key={i} item={item} />
            ))}
          </ul>
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

interface ItemSummaryProps {
  item: LocalItem;
}

function ItemSummary({ item }: ItemSummaryProps) {
  const heading = item.subFeatureName
    ? `${item.productName} · ${item.subFeatureName}`
    : item.productName;

  const answered = Object.values(item.answers).filter((v) => v.trim() !== "").length;
  const total = Object.keys(item.answers).length;

  return (
    <li
      className="rounded-md"
      style={{
        padding: "10px 12px",
        background: "#FBFBFA",
        border: "1px solid var(--color-warm-gray-light)",
      }}
    >
      <div className="text-near-black font-semibold" style={{ fontSize: 14 }}>
        {heading}
      </div>
      {total > 0 && (
        <div className="text-warm-gray-med mt-1" style={{ fontSize: 12 }}>
          {answered} of {total} {total === 1 ? "question" : "questions"} answered
        </div>
      )}
    </li>
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
