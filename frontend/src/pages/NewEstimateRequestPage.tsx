import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  Search,
  X,
} from "lucide-react";
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
import { ApiError } from "../lib/api";
import { uploadAnswerDocument, deleteAnswerDocument } from "../lib/api/documents";
import type { AttachmentMeta } from "../lib/api/estimates";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { TypedAnswerInput } from "../components/TypedAnswerInput";
import { AnswerValue } from "../components/AnswerValue";
import { useAuth } from "../lib/auth";
import { useProductsQuery } from "../lib/queries/products";
import { useSubFeaturesForProductQuery, useSubFeatureQuery } from "../lib/queries/subFeatures";
import {
  downloadTemplateFile,
  productTemplateFileDownloadUrl,
  subFeatureTemplateFileDownloadUrl,
} from "../lib/api/templateFiles";
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
import { useActiveCategoriesQuery } from "../lib/queries/categories";
import { useActiveProgramTypesQuery } from "../lib/queries/programTypes";
import { useActiveClientsQuery } from "../lib/queries/clients";
import { useActiveProgramsQuery } from "../lib/queries/programs";
import type { ProductDetail } from "../lib/api/products";
import type { QuestionListItem } from "../lib/api/questions";
import type { CategoryDto } from "../lib/api/categories";
import type { ProgramTypeDto } from "../lib/api/programTypes";
import type { ClientDto } from "../lib/api/clients";
import type { ProgramDto } from "../lib/api/programs";
import { ComboboxInput } from "../components/ComboboxInput";
import { NewClientModal } from "./NewClientModal";
import { NewProgramModal } from "./NewProgramModal";

const CATALOG_STEPS = ["Products", "Questions", "Review"];
const INTAKE_STEPS = ["Requirements", "Questions", "Review"];

type Step = 1 | 2 | 3;

function clampStep(raw: string | null): Step {
  const n = raw ? Number(raw) : 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

type ItemCount = {
  answered: number;
  total: number;
  /** Unanswered required questions / missing required files — drives the
      "why is Continue disabled" explanation under Step 2. */
  missingAnswers: number;
  missingFiles: number;
};

type LocalItem = {
  productId: number;
  productName: string;
  subFeatureId: number | null;
  subFeatureName: string | null;
  itemId: number | null;
  answers: Record<number, string>;
  attachments: Record<number, AttachmentMeta[]>;
};

// =====================================================================
// Root page component
// =====================================================================

export function NewEstimateRequestPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const urlStep = clampStep(params.get("step"));
  const urlId = params.get("id") ? Number(params.get("id")) : null;

  const existingQuery = useMyRequestQuery(urlId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goLiveDate, setGoLiveDate] = useState("");
  const [goLiveDateUnknown, setGoLiveDateUnknown] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [programTypeIds, setProgramTypeIds] = useState<number[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [programId, setProgramId] = useState<number | null>(null);
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [newProgramModalOpen, setNewProgramModalOpen] = useState(false);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(urlId);
  const [savedFlash, setSavedFlash] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [itemsReady, setItemsReady] = useState<boolean[]>([]);
  const [itemCounts, setItemCounts] = useState<Array<ItemCount>>([]);
  const [answerFieldErrors, setAnswerFieldErrors] = useState<Record<number, Record<number, string>>>({});

  const [requestType, setRequestType] = useState<"CATALOG" | "INTAKE" | null>(null);

  const itemsLocked = draftId != null;

  useEffect(() => {
    if (!urlId || !existingQuery.data) return;
    const d = existingQuery.data;
    setTitle(d.title);
    setDescription(d.description ?? "");
    setGoLiveDate(d.goLiveDate ?? "");
    setGoLiveDateUnknown(false);
    setCategoryId(d.categoryId ?? null);
    setProgramTypeIds(d.programTypeIds ?? []);
    setClientId(d.clientId ?? null);
    setProgramId(d.programId ?? null);
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
      attachments: item.answers.reduce(
        (acc, a) =>
          a.attachments.length > 0
            ? { ...acc, [a.questionId]: a.attachments }
            : acc,
        {} as Record<number, AttachmentMeta[]>,
      ),
    }));
    setLocalItems(hydrated);
    setDirty(false);
    setDraftId(d.id);
    setRequestType((d.requestType as "CATALOG" | "INTAKE") ?? "CATALOG");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingQuery.data?.id]);

  useEffect(() => {
    document.title = "New estimate request — Estimator";
  }, []);

  useUnsavedChangesGuard(dirty);

  const productsQuery = useProductsQuery({ status: "ACTIVE", size: 100 });
  const products = productsQuery.data?.items ?? [];
  const categoriesQuery = useActiveCategoriesQuery();
  const programTypesQuery = useActiveProgramTypesQuery();
  const clientsQuery = useActiveClientsQuery();
  const programsQuery = useActiveProgramsQuery(clientId ?? undefined);

  const createMutation = useCreateDraftMutation();
  const updateMutation = useUpdateDraftMutation();
  const saveItemAnswersMutation = useSaveDraftItemAnswersMutation();
  const submitMutation = useSubmitRequestMutation();
  const discardMutation = useDiscardDraftMutation();

  const step: Step = urlStep;

  useEffect(() => {
    if (!urlId && urlStep > 1) {
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set("step", "1");
          return next;
        },
        { replace: true },
      );
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

  function addItem(
    productId: number,
    productName: string,
    subFeatureId: number | null,
    subFeatureName: string | null,
  ) {
    setLocalItems((prev) => [
      ...prev,
      { productId, productName, subFeatureId, subFeatureName, itemId: null, answers: {}, attachments: {} },
    ]);
    setDirty(true);
  }

  function removeItem(index: number) {
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
    setItemsReady((prev) => prev.filter((_, i) => i !== index));
    setItemCounts((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  async function ensureDraftThen(advanceTo?: Step) {
    if (requestType === "CATALOG" && localItems.length === 0) {
      toast.error("Add at least one product first.");
      return;
    }
    try {
      let id = draftId;
      const resolvedGoLiveDate = goLiveDateUnknown ? null : goLiveDate || null;
      if (id == null) {
        const created = await createMutation.mutateAsync({
          title: title.trim(),
          description: description.trim(),
          goLiveDate: resolvedGoLiveDate,
          categoryId: categoryId!,
          programTypeIds,
          clientId: clientId!,
          programId: programId!,
          requestType: requestType ?? "CATALOG",
          items: requestType === "INTAKE"
            ? []
            : localItems.map((item) => ({
                productId: item.productId,
                subFeatureId: item.subFeatureId ?? null,
              })),
        });
        id = created.id;
        setDraftId(id);
        if (requestType === "INTAKE") {
          // Hydrate localItems from the backend-created CONTEXT item
          const hydrated = created.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            subFeatureId: item.subFeatureId,
            subFeatureName: item.subFeatureName,
            itemId: item.id,
            answers: item.answers.reduce(
              (acc, a) => ({ ...acc, [a.questionId]: a.answerText }),
              {} as Record<number, string>,
            ),
            attachments: item.answers.reduce(
              (acc, a) =>
                a.attachments.length > 0
                  ? { ...acc, [a.questionId]: a.attachments }
                  : acc,
              {} as Record<number, AttachmentMeta[]>,
            ),
          }));
          setLocalItems(hydrated);
        } else {
          setLocalItems((prev) =>
            prev.map((item, i) => ({ ...item, itemId: created.items[i]?.id ?? null })),
          );
        }
      } else {
        await updateMutation.mutateAsync({
          id,
          body: {
            title: title.trim(),
            description: description.trim() || null,
            goLiveDate: resolvedGoLiveDate,
            categoryId: categoryId ?? undefined,
            programTypeIds: programTypeIds.length > 0 ? programTypeIds : undefined,
            clientId: clientId ?? undefined,
            programId: programId ?? undefined,
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
    let savingItemId: number | null = null;
    try {
      for (const item of localItems) {
        if (item.itemId == null) continue;
        savingItemId = item.itemId;
        const answersToSave = Object.entries(item.answers)
          .map(([qid, text]) => ({ questionId: Number(qid), answerText: text }))
          .filter((a) => a.answerText.trim() !== "");
        await saveItemAnswersMutation.mutateAsync({
          id: draftId,
          itemId: item.itemId,
          body: { answers: answersToSave },
        });
      }
      setAnswerFieldErrors({});
      setDirty(false);
      if (advanceTo) setStep(advanceTo);
      else flashSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { fieldErrors?: Record<string, string> };
        if (body?.fieldErrors && savingItemId != null) {
          const qErrors: Record<number, string> = {};
          for (const [key, msg] of Object.entries(body.fieldErrors)) {
            const m = key.match(/^question:(\d+)$/);
            if (m) qErrors[Number(m[1])] = msg;
          }
          if (Object.keys(qErrors).length > 0) {
            setAnswerFieldErrors({ [savingItemId]: qErrors });
          }
        }
      }
      toast.error(err instanceof Error ? err.message : "Could not save answers.");
    }
  }

  async function performSubmit() {
    if (draftId == null) return;
    try {
      await persistAllAnswers();
      const submitted = await submitMutation.mutateAsync(draftId);
      toast.success(
        requestType === "INTAKE"
          ? "Request submitted. Solution Owners will review your requirements and scope the work."
          : "Request submitted. The Solution Owner team will review your request.",
      );
      navigate(`/requests/${submitted.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not submit the request.",
      );
    }
  }

  const handleItemReadyChange = useCallback((index: number, ready: boolean) => {
    setItemsReady((prev) => {
      const next = [...prev];
      next[index] = ready;
      return next;
    });
  }, []);

  const handleItemCountChange = useCallback(
    (index: number, answered: number, total: number, missingAnswers: number, missingFiles: number) => {
      setItemCounts((prev) => {
        const next = [...prev];
        next[index] = { answered, total, missingAnswers, missingFiles };
        return next;
      });
    },
    [],
  );

  const handleItemAnswerChange = useCallback(
    (itemIndex: number, qid: number, value: string) => {
      setLocalItems((prev) => {
        const next = [...prev];
        next[itemIndex] = {
          ...next[itemIndex],
          answers: { ...next[itemIndex].answers, [qid]: value },
        };
        return next;
      });
      setDirty(true);
      setAnswerFieldErrors({});
    },
    [],
  );

  const handleItemAttachmentChange = useCallback(
    (itemIndex: number, qid: number, meta: AttachmentMeta | null, removeId?: number) => {
      setLocalItems((prev) => {
        const next = [...prev];
        const current = { ...next[itemIndex].attachments };
        if (meta) {
          current[qid] = [...(current[qid] ?? []), meta];
        } else if (removeId !== undefined) {
          const filtered = (current[qid] ?? []).filter((a) => a.id !== removeId);
          if (filtered.length > 0) current[qid] = filtered;
          else delete current[qid];
        }
        next[itemIndex] = { ...next[itemIndex], attachments: current };
        return next;
      });
    },
    [],
  );

  // ---- Step 2 autosave (UX-2). Debounce the answers snapshot and persist
  // quietly after the requester stops typing; the ref skips the initial
  // hydration snapshot so entering the step doesn't fire a save.
  const answersSnapshot = useMemo(
    () => JSON.stringify(localItems.map((it) => [it.itemId, it.answers])),
    [localItems],
  );
  const debouncedAnswersSnapshot = useDebouncedValue(answersSnapshot, 1600);
  const lastAutosavedRef = useRef<string | null>(null);
  useEffect(() => {
    if (step !== 2 || draftId == null) {
      lastAutosavedRef.current = null;
      return;
    }
    if (lastAutosavedRef.current === null) {
      lastAutosavedRef.current = debouncedAnswersSnapshot;
      return;
    }
    if (debouncedAnswersSnapshot === lastAutosavedRef.current) return;
    if (saveItemAnswersMutation.isPending) return;
    lastAutosavedRef.current = debouncedAnswersSnapshot;
    void persistAllAnswers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAnswersSnapshot, step, draftId]);

  const allItemsReady =
    itemsReady.length === localItems.length &&
    localItems.length > 0 &&
    itemsReady.every(Boolean);

  const requesterName = user ? `${user.firstName} ${user.lastName}` : "";

  const resolvedCategoryName =
    (categoriesQuery.data ?? []).find((c) => c.id === categoryId)?.name ?? null;
  const resolvedProgramTypeNames = (programTypesQuery.data ?? [])
    .filter((pt) => programTypeIds.includes(pt.id))
    .map((pt) => pt.name);
  const resolvedClientName =
    (clientsQuery.data ?? []).find((c) => c.id === clientId)?.name ?? null;
  const resolvedProgramName =
    (programsQuery.data ?? []).find((p) => p.id === programId)?.name ?? null;

  const selectedClient = (clientsQuery.data ?? []).find((c) => c.id === clientId) ?? null;

  const activeSteps = requestType === "INTAKE" ? INTAKE_STEPS : CATALOG_STEPS;

  const catalogContinueDisabled =
    title.trim() === "" ||
    description.trim() === "" ||
    (!goLiveDateUnknown && goLiveDate === "") ||
    localItems.length === 0 ||
    categoryId == null ||
    programTypeIds.length === 0 ||
    clientId == null ||
    programId == null;

  const intakeContinueDisabled =
    title.trim() === "" ||
    description.trim() === "" ||
    (!goLiveDateUnknown && goLiveDate === "") ||
    categoryId == null ||
    programTypeIds.length === 0 ||
    clientId == null ||
    programId == null;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Workspace" },
          { label: "Estimate requests", to: "/requests" },
          { label: "New" },
        ]}
        title="New estimate request"
      />

      {/* Request type selection — shown only before a type is chosen */}
      {requestType === null && draftId === null && (
        <RequestTypeSelection onSelect={(t) => setRequestType(t)} />
      )}

      {requestType !== null && (
        <>
          <div style={{ marginTop: 24, marginBottom: 28 }}>
            <Stepper steps={activeSteps} currentStep={step - 1} />
          </div>

          {step === 1 && (
            <Step1
              title={title}
              description={description}
              goLiveDate={goLiveDate}
              goLiveDateUnknown={goLiveDateUnknown}
              categoryId={categoryId}
              programTypeIds={programTypeIds}
              categories={categoriesQuery.data ?? []}
              programTypes={programTypesQuery.data ?? []}
              clients={clientsQuery.data ?? []}
              programs={programsQuery.data ?? []}
              clientId={clientId}
              programId={programId}
              localItems={localItems}
              products={products}
              itemsLocked={itemsLocked}
              savedFlash={savedFlash}
              saving={createMutation.isPending || updateMutation.isPending}
              requestType={requestType}
              onTitleChange={(v) => {
                setTitle(v);
                setDirty(true);
              }}
              onDescriptionChange={(v) => {
                setDescription(v);
                setDirty(true);
              }}
              onGoLiveDateChange={(v) => {
                setGoLiveDate(v);
                setGoLiveDateUnknown(false);
                setDirty(true);
              }}
              onGoLiveDateUnknownChange={(unknown) => {
                setGoLiveDateUnknown(unknown);
                if (unknown) setGoLiveDate("");
                setDirty(true);
              }}
              onCategoryChange={(id) => {
                setCategoryId(id);
                setDirty(true);
              }}
              onProgramTypesChange={(ids) => {
                setProgramTypeIds(ids);
                setDirty(true);
              }}
              onClientChange={(id) => {
                setClientId(id);
                setProgramId(null);
                setDirty(true);
              }}
              onClientClear={() => {
                setClientId(null);
                setProgramId(null);
                setDirty(true);
              }}
              onProgramChange={(id) => {
                setProgramId(id);
                setDirty(true);
              }}
              onProgramClear={() => {
                setProgramId(null);
                setDirty(true);
              }}
              onOpenNewClientModal={() => setNewClientModalOpen(true)}
              onOpenNewProgramModal={() => setNewProgramModalOpen(true)}
              onAddItem={addItem}
              onRemoveItem={removeItem}
              onCancel={() => setCancelOpen(true)}
              onSaveDraft={() => void ensureDraftThen()}
              onContinue={() => void ensureDraftThen(2)}
              continueDisabled={
                requestType === "INTAKE" ? intakeContinueDisabled : catalogContinueDisabled
              }
            />
          )}

          {step === 2 && (
            <Step2
              localItems={localItems}
              products={products}
              savedFlash={savedFlash}
              saving={saveItemAnswersMutation.isPending}
              allItemsReady={allItemsReady}
              itemCounts={itemCounts}
              answerFieldErrors={answerFieldErrors}
              onItemAnswerChange={handleItemAnswerChange}
              onItemAttachmentChange={handleItemAttachmentChange}
              onItemReadyChange={handleItemReadyChange}
              onItemCountChange={handleItemCountChange}
              onBack={() => setStep(1)}
              onSaveDraft={() => void persistAllAnswers()}
              onContinue={() => void persistAllAnswers(3)}
            />
          )}

          {step === 3 && (
            <Step3
              title={title}
              description={description}
              goLiveDate={goLiveDate}
              goLiveDateUnknown={goLiveDateUnknown}
              categoryName={resolvedCategoryName}
              programTypeNames={resolvedProgramTypeNames}
              clientName={resolvedClientName}
              programName={resolvedProgramName}
              localItems={localItems}
              products={products}
              requesterName={requesterName}
              requestType={requestType ?? "CATALOG"}
              submitting={submitMutation.isPending || saveItemAnswersMutation.isPending}
              onBack={() => setStep(2)}
              onGoToStep1={() => setStep(1)}
              onGoToStep2={() => setStep(2)}
              onSaveDraft={() => void persistAllAnswers()}
              onSubmit={performSubmit}
            />
          )}
        </>
      )}

      <NewClientModal
        open={newClientModalOpen}
        defaultPointOfContact={user ? `${user.firstName} ${user.lastName}` : ""}
        onClose={() => setNewClientModalOpen(false)}
        onCreated={(client) => {
          setClientId(client.id);
          setProgramId(null);
          setNewClientModalOpen(false);
          setDirty(true);
        }}
      />

      {clientId != null && selectedClient != null && (
        <NewProgramModal
          open={newProgramModalOpen}
          clientId={clientId}
          clientName={selectedClient.name}
          onClose={() => setNewProgramModalOpen(false)}
          onCreated={(program) => {
            setProgramId(program.id);
            setNewProgramModalOpen(false);
            setDirty(true);
          }}
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
        onConfirm={async () => {
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
        }}
      />
    </>
  );
}

// =====================================================================
// Request type selection screen (shown before Step 1)
// =====================================================================

function RequestTypeSelection({ onSelect }: { onSelect: (t: "CATALOG" | "INTAKE") => void }) {
  return (
    <div style={{ marginTop: 32, maxWidth: 600 }}>
      <h2
        className="text-near-black font-semibold"
        style={{ fontSize: 18, margin: "0 0 8px", letterSpacing: "-0.005em" }}
      >
        What type of estimate do you need?
      </h2>
      <p className="text-warm-gray-med" style={{ fontSize: 14, margin: "0 0 24px" }}>
        Choose how you want to set up this request.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Catalog option */}
        <button
          type="button"
          onClick={() => onSelect("CATALOG")}
          className="w-full text-left bg-white rounded-lg"
          style={{
            border: "1.5px solid var(--color-border)",
            padding: "18px 20px",
            cursor: "pointer",
            transition: "border-color 120ms ease, box-shadow 120ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-near-black)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px var(--color-near-black)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <div className="text-near-black font-semibold" style={{ fontSize: 15, marginBottom: 4 }}>
            Catalog request
          </div>
          <div className="text-warm-gray-med" style={{ fontSize: 13, lineHeight: "18px" }}>
            I know which products I need estimated. I'll select them from the catalog.
          </div>
        </button>

        {/* Intake option */}
        <button
          type="button"
          onClick={() => onSelect("INTAKE")}
          className="w-full text-left bg-white rounded-lg"
          style={{
            border: "1.5px solid var(--color-border)",
            padding: "18px 20px",
            cursor: "pointer",
            transition: "border-color 120ms ease, box-shadow 120ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-near-black)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px var(--color-near-black)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <div className="text-near-black font-semibold" style={{ fontSize: 15, marginBottom: 4 }}>
            Generic intake request
          </div>
          <div className="text-warm-gray-med" style={{ fontSize: 13, lineHeight: "18px" }}>
            I'm not sure which products are in scope. I'll describe my requirements and
            Solution Owners will determine what to estimate.
          </div>
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Step 1 — Products
// =====================================================================

interface Step1Props {
  title: string;
  description: string;
  goLiveDate: string;
  goLiveDateUnknown: boolean;
  categoryId: number | null;
  programTypeIds: number[];
  categories: CategoryDto[];
  programTypes: ProgramTypeDto[];
  clients: ClientDto[];
  programs: ProgramDto[];
  clientId: number | null;
  programId: number | null;
  localItems: LocalItem[];
  products: ProductDetail[];
  itemsLocked: boolean;
  savedFlash: boolean;
  saving: boolean;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onGoLiveDateChange: (date: string) => void;
  onGoLiveDateUnknownChange: (unknown: boolean) => void;
  onCategoryChange: (id: number | null) => void;
  onProgramTypesChange: (ids: number[]) => void;
  onClientChange: (id: number) => void;
  onClientClear: () => void;
  onProgramChange: (id: number) => void;
  onProgramClear: () => void;
  onOpenNewClientModal: () => void;
  onOpenNewProgramModal: () => void;
  onAddItem: (
    productId: number,
    productName: string,
    subFeatureId: number | null,
    subFeatureName: string | null,
  ) => void;
  onRemoveItem: (index: number) => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
  continueDisabled: boolean;
  requestType: "CATALOG" | "INTAKE";
}

function Step1({
  title,
  description,
  goLiveDate,
  goLiveDateUnknown,
  categoryId,
  programTypeIds,
  categories,
  programTypes,
  clients,
  programs,
  clientId,
  programId,
  localItems,
  products,
  itemsLocked,
  savedFlash,
  saving,
  requestType,
  onTitleChange,
  onDescriptionChange,
  onGoLiveDateChange,
  onGoLiveDateUnknownChange,
  onCategoryChange,
  onProgramTypesChange,
  onClientChange,
  onClientClear,
  onProgramChange,
  onProgramClear,
  onOpenNewClientModal,
  onOpenNewProgramModal,
  onAddItem,
  onRemoveItem,
  onCancel,
  onSaveDraft,
  onContinue,
  continueDisabled,
}: Step1Props) {
  return (
    <>
      {/* About card */}
      <section
        className="bg-white rounded-lg"
        style={{
          border: "1px solid var(--color-border)",
          padding: "22px 24px",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px",
            gap: "20px 24px",
          }}
        >
          {/* Client */}
          <div>
            <label
              htmlFor="request-client"
              className="block text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 4 }}
            >
              Client <span className="text-cardinal-red">*</span>
            </label>
            <ComboboxInput
              id="request-client"
              placeholder="Search clients…"
              options={clients.map((c) => ({ id: c.id, label: c.name }))}
              value={clientId}
              onChange={onClientChange}
              onClear={onClientClear}
              onCreateNew={onOpenNewClientModal}
              createNewLabel="New client"
              required
            />
          </div>

          {/* Program */}
          <div>
            <label
              htmlFor="request-program"
              className="block text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 4 }}
            >
              Program <span className="text-cardinal-red">*</span>
              {clientId == null && (
                <span className="text-warm-gray-med font-normal" style={{ marginLeft: 6 }}>
                  (select a client first)
                </span>
              )}
            </label>
            <ComboboxInput
              id="request-program"
              placeholder="Search programs…"
              options={programs.map((p) => ({ id: p.id, label: p.name }))}
              value={programId}
              onChange={onProgramChange}
              onClear={onProgramClear}
              onCreateNew={onOpenNewProgramModal}
              createNewLabel="New program"
              disabled={clientId == null}
              required
            />
          </div>

          <div>
            <TextInput
              id="request-title"
              label="Estimate title"
              value={title}
              onChange={(e) => onTitleChange(e.currentTarget.value)}
              maxLength={255}
              required
            />
          </div>
          <div>
            <label
              className="block text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 4 }}
            >
              Requested go live <span className="text-cardinal-red">*</span>
            </label>
            <input
              type="date"
              value={goLiveDate}
              disabled={goLiveDateUnknown}
              onChange={(e) => onGoLiveDateChange(e.currentTarget.value)}
              className="w-full rounded-md border border-border bg-white text-body text-near-black h-8 px-3 disabled:bg-warm-gray-light disabled:text-warm-gray-med focus:outline-none focus:border-warm-gray-med focus:ring-2 focus:ring-accent"
            />
            <label
              className="inline-flex items-center cursor-pointer"
              style={{ marginTop: 6, gap: 6, fontSize: 12 }}
            >
              <input
                type="checkbox"
                checked={goLiveDateUnknown}
                onChange={(e) => onGoLiveDateUnknownChange(e.currentTarget.checked)}
                className="rounded border-border"
                style={{
                  width: 14,
                  height: 14,
                  accentColor: "var(--color-near-black)",
                }}
              />
              <span className="text-warm-gray-med">Unknown at this time</span>
            </label>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Textarea
              id="request-description"
              label="Description"
              helper="Add context — business goal, related projects, stakeholders…"
              required
              rows={3}
              value={description}
              onChange={(e) => onDescriptionChange(e.currentTarget.value)}
              maxLength={4000}
            />
          </div>
          {/* Category */}
          <div>
            <label
              htmlFor="request-category"
              className="block text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 4 }}
            >
              Category <span className="text-cardinal-red">*</span>
            </label>
            <select
              id="request-category"
              value={categoryId ?? ""}
              onChange={(e) => onCategoryChange(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
              className="w-full rounded-md border border-border bg-white text-body text-near-black h-8 px-3 focus:outline-none focus:border-warm-gray-med focus:ring-2 focus:ring-accent"
              style={{ fontSize: 13 }}
              required
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {/* Program Types */}
          <div>
            <span
              className="block text-near-black font-medium"
              style={{ fontSize: 13, marginBottom: 6 }}
            >
              Program type <span className="text-cardinal-red">*</span>{" "}
              <span className="text-warm-gray-med font-normal">(select all that apply)</span>
            </span>
            <div className="flex flex-col gap-2">
              {programTypes.map((pt) => (
                <label
                  key={pt.id}
                  className="inline-flex items-center cursor-pointer"
                  style={{ gap: 8, fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={programTypeIds.includes(pt.id)}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        onProgramTypesChange([...programTypeIds, pt.id]);
                      } else {
                        onProgramTypesChange(programTypeIds.filter((id) => id !== pt.id));
                      }
                    }}
                    className="rounded border-border"
                    style={{
                      width: 14,
                      height: 14,
                      accentColor: "var(--color-near-black)",
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-near-black">{pt.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTAKE info banner */}
      {requestType === "INTAKE" && (
        <div
          className="rounded-lg flex"
          style={{
            padding: "13px 16px",
            marginBottom: 20,
            gap: 12,
            background: "rgba(187, 221, 230, 0.18)",
            border: "1px solid rgba(187, 221, 230, 0.80)",
            fontSize: 13,
            color: "var(--fg-1)",
            lineHeight: "18px",
            alignItems: "flex-start",
          }}
        >
          <div>
            <strong style={{ color: "#2C5666" }}>Generic intake request</strong>
            {" — "}
            Describe your requirements below. Once submitted, Solution Owners will review
            your requirements and add the relevant products they need to estimate.
          </div>
        </div>
      )}

      {/* Products section — CATALOG only */}
      {requestType === "CATALOG" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <h2
              className="text-near-black font-semibold"
              style={{ fontSize: 18, letterSpacing: "-0.005em", margin: 0 }}
            >
              Products
            </h2>
            <p className="text-warm-gray-med" style={{ fontSize: 13, margin: "2px 0 0" }}>
              {itemsLocked
                ? "Products are locked once the draft is saved — start a new request to change this list."
                : "Click a product to add it. Container products expand to show their sub-features."}
            </p>
          </div>

          <ProductBrowser
            products={products}
            localItems={localItems}
            itemsLocked={itemsLocked}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
          />
        </>
      )}

      <FooterRow left={<TertiaryButton onClick={onCancel}>Cancel</TertiaryButton>}>
        <SecondaryButton
          disabled={saving || title.trim() === "" || (requestType === "CATALOG" && localItems.length === 0)}
          onClick={onSaveDraft}
        >
          {savedFlash ? "Saved" : "Save draft"}
        </SecondaryButton>
        <PrimaryButton disabled={continueDisabled || saving} onClick={onContinue}>
          Continue
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PrimaryButton>
      </FooterRow>
    </>
  );
}

// =====================================================================
// Product Browser (Step 1 left panel + cart)
// =====================================================================

interface ProductBrowserProps {
  products: ProductDetail[];
  localItems: LocalItem[];
  itemsLocked: boolean;
  onAddItem: (
    productId: number,
    productName: string,
    subFeatureId: number | null,
    subFeatureName: string | null,
  ) => void;
  onRemoveItem: (index: number) => void;
}

type ProductGroup = {
  teamId: number | null;
  teamName: string;
  products: ProductDetail[];
};

function ProductBrowser({
  products,
  localItems,
  itemsLocked,
  onAddItem,
  onRemoveItem,
}: ProductBrowserProps) {
  const [search, setSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    for (const p of products) {
      const key = p.team ? `${p.team.id}:${p.team.name}` : "unassigned";
      if (!map.has(key)) {
        map.set(key, {
          teamId: p.team?.id ?? null,
          teamName: p.team?.name ?? "Unassigned",
          products: [],
        });
      }
      map.get(key)!.products.push(p);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.teamName === "Unassigned") return 1;
      if (b.teamName === "Unassigned") return -1;
      return a.teamName.localeCompare(b.teamName);
    });
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        products: g.products.filter((p) =>
          p.name.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.products.length > 0);
  }, [groups, search]);

  function isItemAdded(productId: number, subFeatureId: number | null) {
    return localItems.some(
      (i) => i.productId === productId && i.subFeatureId === subFeatureId,
    );
  }

  function handleProductClick(product: ProductDetail) {
    if (itemsLocked) return;
    if (product.mode === "ATOMIC") {
      if (!isItemAdded(product.id, null)) {
        onAddItem(product.id, product.name, null, null);
      }
    } else {
      setExpandedProductId((prev) => (prev === product.id ? null : product.id));
    }
  }

  function toggleTeam(teamName: string) {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamName)) next.delete(teamName);
      else next.add(teamName);
      return next;
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 300px",
        gap: 20,
        alignItems: "start",
        marginBottom: 24,
      }}
    >
      {/* Left: browser */}
      <div
        className="bg-white rounded-lg"
        style={{ border: "1px solid var(--color-border)", overflow: "hidden" }}
      >
        {/* Search bar */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--color-warm-gray-light)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <label
            className="flex items-center"
            style={{
              flex: 1,
              gap: 8,
              padding: "0 10px",
              height: 32,
              background: "var(--color-warm-gray-light)",
              borderRadius: 6,
              border: "1px solid transparent",
            }}
          >
            <Search
              style={{ width: 13, height: 13, flexShrink: 0, color: "var(--fg-2)" }}
              strokeWidth={1.5}
            />
            <input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              className="bg-transparent border-0 outline-none text-near-black"
              style={{ flex: 1, fontSize: 13 }}
            />
          </label>
          <span className="text-warm-gray-med" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
            {products.length} products · {groups.length} teams
          </span>
        </div>

        {/* Product list */}
        <div style={{ maxHeight: 480, overflowY: "auto", padding: "4px 0 8px" }}>
          {filtered.length === 0 && (
            <p
              className="text-warm-gray-med"
              style={{ padding: "20px 16px", fontSize: 13, margin: 0 }}
            >
              No products match your search.
            </p>
          )}
          {filtered.map((group) => {
            const collapsed = collapsedTeams.has(group.teamName);
            return (
              <div key={group.teamName}>
                {/* Team header */}
                <button
                  type="button"
                  onClick={() => toggleTeam(group.teamName)}
                  className="w-full flex items-center bg-transparent border-0 cursor-pointer"
                  style={{ padding: "8px 14px", gap: 8 }}
                >
                  <ChevronDown
                    style={{
                      width: 12,
                      height: 12,
                      flexShrink: 0,
                      color: "var(--fg-2)",
                      transform: collapsed ? "rotate(-90deg)" : "none",
                      transition: "transform 160ms ease",
                    }}
                    strokeWidth={2}
                  />
                  <span
                    className="text-warm-gray-med font-medium uppercase"
                    style={{ fontSize: 11, letterSpacing: "0.06em" }}
                  >
                    {group.teamName}
                  </span>
                  <span className="text-warm-gray-med" style={{ fontSize: 11, marginLeft: "auto" }}>
                    {group.products.length}
                  </span>
                </button>

                {/* Products in team */}
                {!collapsed &&
                  group.products.map((product) => {
                    const isAtomic = product.mode === "ATOMIC";
                    const atomicAdded = isAtomic && isItemAdded(product.id, null);
                    const isExpanded = expandedProductId === product.id;

                    return (
                      <div key={product.id}>
                        <button
                          type="button"
                          disabled={itemsLocked || atomicAdded}
                          onClick={() => handleProductClick(product)}
                          className="w-full flex items-center text-left bg-transparent border-0"
                          style={{
                            padding: "9px 14px 9px 34px",
                            gap: 10,
                            fontSize: 14,
                            color: atomicAdded ? "var(--fg-2)" : "var(--fg-1)",
                            background: isExpanded
                              ? "var(--color-light-blue-soft)"
                              : "transparent",
                            cursor: itemsLocked || atomicAdded ? "default" : "pointer",
                          }}
                          onMouseEnter={(e) => {
                            if (!itemsLocked && !atomicAdded)
                              e.currentTarget.style.background = isExpanded
                                ? "var(--color-light-blue-soft)"
                                : "var(--color-warm-gray-light)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isExpanded
                              ? "var(--color-light-blue-soft)"
                              : "transparent";
                          }}
                        >
                          {/* Mode icon */}
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              flexShrink: 0,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isAtomic ? (
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: "var(--fg-2)",
                                }}
                              />
                            ) : (
                              <ChevronRight
                                style={{
                                  width: 12,
                                  height: 12,
                                  color: "var(--fg-2)",
                                  transform: isExpanded ? "rotate(90deg)" : "none",
                                  transition: "transform 160ms ease",
                                }}
                                strokeWidth={1.7}
                              />
                            )}
                          </span>

                          {/* Name */}
                          <span style={{ flex: 1, minWidth: 0 }}>{product.name}</span>

                          {/* Right metadata */}
                          {atomicAdded ? (
                            <span
                              className="inline-flex items-center font-medium"
                              style={{ fontSize: 11, color: "var(--color-success)", gap: 4 }}
                            >
                              <Check style={{ width: 11, height: 11 }} strokeWidth={2.5} />
                              Added
                            </span>
                          ) : !isAtomic && product.subFeatureCount > 0 ? (
                            <span className="text-warm-gray-med" style={{ fontSize: 11 }}>
                              {product.subFeatureCount} sub-feature
                              {product.subFeatureCount !== 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </button>

                        {/* Inline sub-feature list */}
                        {!isAtomic && isExpanded && (
                          <ContainerSubFeatureList
                            productId={product.id}
                            localItems={localItems}
                            itemsLocked={itemsLocked}
                            onAdd={(subFeatureId, subFeatureName) =>
                              onAddItem(
                                product.id,
                                product.name,
                                subFeatureId,
                                subFeatureName,
                              )
                            }
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: cart */}
      <div style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          className="bg-white rounded-lg"
          style={{ border: "1px solid var(--color-border)", overflow: "hidden" }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--color-warm-gray-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>
              Selected
            </span>
            <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
              {localItems.length} {localItems.length === 1 ? "item" : "items"}
            </span>
          </div>

          {localItems.length === 0 ? (
            <div style={{ padding: "24px 14px", textAlign: "center" }}>
              <p className="text-warm-gray-med" style={{ fontSize: 13, margin: 0, lineHeight: "18px" }}>
                No products selected yet.
                <br />
                Click a product to add it.
              </p>
            </div>
          ) : (
            <ul className="m-0 p-0 list-none">
              {localItems.map((item, i) => (
                <li
                  key={`${item.productId}-${item.subFeatureId ?? "null"}-${i}`}
                  style={{
                    padding: "10px 14px",
                    borderBottom:
                      i < localItems.length - 1
                        ? "1px solid var(--color-warm-gray-light)"
                        : "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="text-near-black font-medium"
                      style={{ fontSize: 14, lineHeight: "18px" }}
                    >
                      {item.productName}
                    </div>
                    {item.subFeatureName && (
                      <div className="text-warm-gray-med" style={{ fontSize: 12, marginTop: 2 }}>
                        └ {item.subFeatureName}
                      </div>
                    )}
                  </div>
                  {!itemsLocked && (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(i)}
                      aria-label={`Remove ${item.productName}`}
                      className="inline-flex items-center justify-center bg-transparent border-0 cursor-pointer text-warm-gray-med rounded"
                      style={{ width: 22, height: 22, flexShrink: 0, padding: 0 }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color =
                          "var(--color-cardinal-red)";
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--color-warm-gray-light)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--fg-2)";
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <X style={{ width: 13, height: 13 }} strokeWidth={2} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lock note */}
        <div
          className="rounded-lg flex"
          style={{
            padding: "11px 13px",
            gap: 10,
            background: "rgba(184, 134, 11, 0.06)",
            border: "1px solid rgba(184, 134, 11, 0.20)",
            fontSize: 12,
            color: "var(--fg-1)",
            lineHeight: "18px",
            alignItems: "flex-start",
          }}
        >
          <Lock
            style={{
              width: 13,
              height: 13,
              color: "var(--color-warning)",
              flexShrink: 0,
              marginTop: 1,
            }}
            strokeWidth={2}
          />
          <div>
            <strong style={{ color: "var(--color-warning)" }}>Heads-up:</strong> Products lock when you
            save the draft. To change this list later, you'll need to start a new request.
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Sub-feature inline list (loads on demand when container is expanded)
// =====================================================================

interface ContainerSubFeatureListProps {
  productId: number;
  localItems: LocalItem[];
  itemsLocked: boolean;
  onAdd: (subFeatureId: number, subFeatureName: string) => void;
}

function ContainerSubFeatureList({
  productId,
  localItems,
  itemsLocked,
  onAdd,
}: ContainerSubFeatureListProps) {
  const query = useSubFeaturesForProductQuery(productId);
  const subFeatures = (query.data ?? []).filter((s) => s.active);

  if (query.isPending) {
    return (
      <div className="text-warm-gray-med" style={{ padding: "8px 14px 8px 52px", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  if (subFeatures.length === 0) {
    return (
      <div className="text-warm-gray-med" style={{ padding: "8px 14px 8px 52px", fontSize: 13 }}>
        No sub-features available.
      </div>
    );
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--color-warm-gray-light)",
        borderBottom: "1px solid var(--color-warm-gray-light)",
        background: "#FAFAF9",
      }}
    >
      {subFeatures.map((sf) => {
        const added = localItems.some(
          (i) => i.productId === productId && i.subFeatureId === sf.id,
        );
        return (
          <button
            key={sf.id}
            type="button"
            disabled={itemsLocked || added}
            onClick={() => !added && onAdd(sf.id, sf.name)}
            className="w-full flex items-center text-left bg-transparent border-0"
            style={{
              padding: "9px 14px 9px 52px",
              gap: 10,
              fontSize: 13,
              color: added ? "var(--fg-2)" : "var(--fg-1)",
              cursor: itemsLocked || added ? "default" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!itemsLocked && !added)
                e.currentTarget.style.background = "var(--color-warm-gray-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{sf.name}</span>
            {added && (
              <span
                className="inline-flex items-center font-medium"
                style={{ fontSize: 11, color: "var(--color-success)", gap: 4 }}
              >
                <Check style={{ width: 11, height: 11 }} strokeWidth={2.5} />
                Added
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// Step 2 — Answer questions (rail + accordion)
// =====================================================================

interface Step2Props {
  localItems: LocalItem[];
  products: ProductDetail[];
  savedFlash: boolean;
  saving: boolean;
  allItemsReady: boolean;
  itemCounts: Array<ItemCount>;
  answerFieldErrors: Record<number, Record<number, string>>;
  onItemAnswerChange: (itemIndex: number, qid: number, value: string) => void;
  onItemAttachmentChange: (itemIndex: number, qid: number, meta: AttachmentMeta | null, removeId?: number) => void;
  onItemReadyChange: (itemIndex: number, ready: boolean) => void;
  onItemCountChange: (itemIndex: number, answered: number, total: number, missingAnswers: number, missingFiles: number) => void;
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
  itemCounts,
  answerFieldErrors,
  onItemAnswerChange,
  onItemAttachmentChange,
  onItemReadyChange,
  onItemCountChange,
  onBack,
  onSaveDraft,
  onContinue,
}: Step2Props) {
  const [openIndex, setOpenIndex] = useState(0);

  const doneCount = itemCounts.filter(
    (c, i) => c && c.total > 0
      ? c.answered >= c.total
      : (itemCounts[i]?.total === 0),
  ).length;

  if (localItems.length === 0) {
    return (
      <>
        <p className="text-warm-gray-med" style={{ fontSize: 14 }}>
          No products selected. Go back and add at least one.
        </p>
        <FooterRow left={<TertiaryButton onClick={onBack}><ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} /> Back</TertiaryButton>}>
          <SecondaryButton disabled={saving} onClick={onSaveDraft}>
            {savedFlash ? "Saved" : "Save draft"}
          </SecondaryButton>
        </FooterRow>
      </>
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 24,
          alignItems: "start",
          marginBottom: 24,
        }}
      >
        {/* Left rail */}
        <aside style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            className="flex items-center justify-between text-warm-gray-med font-medium uppercase"
            style={{ fontSize: 11, letterSpacing: "0.06em", padding: "0 4px 4px" }}
          >
            <span>Items</span>
            <span>
              {doneCount} / {localItems.length} done
            </span>
          </div>
          {localItems.map((item, i) => {
            const counts = itemCounts[i];
            const total = counts?.total ?? 0;
            const answered = counts?.answered ?? 0;
            const isDone = total > 0 && answered >= total;
            const isActive = openIndex === i;

            return (
              <button
                key={`${item.productId}-${item.subFeatureId ?? "null"}-${i}`}
                type="button"
                onClick={() => setOpenIndex(i)}
                className="text-left bg-white rounded-lg border cursor-pointer"
                style={{
                  padding: "12px 14px",
                  borderColor: isActive
                    ? "var(--color-near-black)"
                    : "var(--color-border)",
                  boxShadow: isActive
                    ? "0 0 0 1px var(--color-near-black)"
                    : "none",
                  background: isDone && !isActive ? "#FBFBFA" : "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div className="flex items-start" style={{ gap: 8 }}>
                  {/* Status icon */}
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      flexShrink: 0,
                      marginTop: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isDone
                        ? "var(--color-success)"
                        : "#fff",
                      border: isDone
                        ? "none"
                        : `1.5px solid ${isActive ? "var(--color-near-black)" : "var(--color-border-strong)"}`,
                      position: "relative",
                    }}
                  >
                    {isDone ? (
                      <Check
                        style={{ width: 10, height: 10, color: "#fff" }}
                        strokeWidth={3}
                      />
                    ) : isActive ? (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--color-near-black)",
                        }}
                      />
                    ) : null}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="text-near-black font-semibold"
                      style={{
                        fontSize: 13,
                        lineHeight: "16px",
                        color: isDone && !isActive ? "var(--fg-2)" : "var(--fg-1)",
                      }}
                    >
                      {item.productName}
                    </div>
                    {item.subFeatureName && (
                      <div className="text-warm-gray-med" style={{ fontSize: 11, marginTop: 2 }}>
                        {item.subFeatureName}
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div
                  style={{
                    height: 4,
                    background: "var(--color-warm-gray-light)",
                    borderRadius: 2,
                    overflow: "hidden",
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: total > 0 ? `${Math.round((answered / total) * 100)}%` : "0%",
                      background: "var(--color-near-black)",
                      borderRadius: 2,
                      transition: "width 200ms ease",
                    }}
                  />
                </div>
                <div
                  className="flex items-center justify-between text-warm-gray-med"
                  style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
                >
                  <span>
                    {answered} of {total} answered
                  </span>
                  <span>{isDone ? "Done" : "In progress"}</span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Right: accordion list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {localItems.map((item, i) => {
            const product = products.find((p) => p.id === item.productId) ?? null;
            const counts = itemCounts[i];
            const isDone =
              counts && counts.total > 0 && counts.answered >= counts.total;

            return (
              <ItemSection
                key={`${item.productId}-${item.subFeatureId ?? "null"}-${i}`}
                item={item}
                product={product}
                isOpen={openIndex === i}
                isDone={!!isDone}
                fieldErrors={answerFieldErrors[item.itemId ?? -1] ?? {}}
                onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
                onAnswerChange={(qid, value) => onItemAnswerChange(i, qid, value)}
                onAttachmentChange={(qid, meta, removeId) => onItemAttachmentChange(i, qid, meta, removeId)}
                onReadyChange={(ready) => onItemReadyChange(i, ready)}
                onCountChange={(answered, total, missingAnswers, missingFiles) =>
                  onItemCountChange(i, answered, total, missingAnswers, missingFiles)}
              />
            );
          })}
        </div>
      </div>

      {!allItemsReady && (
        <div
          role="status"
          className="rounded-lg"
          style={{
            border: "1px solid var(--color-warning-border)",
            background: "var(--color-warning-soft)",
            padding: "10px 14px",
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          <span className="font-medium text-near-black">To continue, finish the required questions:</span>
          <ul className="m-0 p-0 list-none" style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
            {localItems.map((item, i) => {
              const c = itemCounts[i];
              if (!c || (c.missingAnswers === 0 && c.missingFiles === 0)) return null;
              const parts: string[] = [];
              if (c.missingAnswers > 0) {
                parts.push(`${c.missingAnswers} required answer${c.missingAnswers === 1 ? "" : "s"}`);
              }
              if (c.missingFiles > 0) {
                parts.push(`${c.missingFiles} required file${c.missingFiles === 1 ? "" : "s"}`);
              }
              return (
                <li key={`missing-${i}`}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(i)}
                    className="bg-transparent border-none p-0 cursor-pointer hover:underline text-left"
                    style={{ fontSize: 13, color: "var(--color-accent)" }}
                  >
                    {item.productName}
                    {item.subFeatureName ? ` / ${item.subFeatureName}` : ""}
                  </button>
                  <span className="text-warm-gray-med"> — {parts.join(", ")} missing</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <FooterRow
        left={
          <TertiaryButton onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Back
          </TertiaryButton>
        }
      >
        <SecondaryButton disabled={saving} onClick={onSaveDraft}>
          {savedFlash ? "Saved" : "Save draft"}
        </SecondaryButton>
        <PrimaryButton disabled={saving || !allItemsReady} onClick={onContinue}>
          Continue
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PrimaryButton>
      </FooterRow>
    </>
  );
}

// =====================================================================
// Item accordion (Step 2)
// =====================================================================

interface ItemSectionProps {
  item: LocalItem;
  product: ProductDetail | null;
  isOpen: boolean;
  isDone: boolean;
  fieldErrors?: Record<number, string>;
  onToggle: () => void;
  onAnswerChange: (qid: number, value: string) => void;
  onAttachmentChange: (qid: number, meta: AttachmentMeta | null, removeId?: number) => void;
  onReadyChange: (ready: boolean) => void;
  onCountChange: (answered: number, total: number, missingAnswers: number, missingFiles: number) => void;
}

function ItemSection({
  item,
  product,
  isOpen,
  isDone,
  fieldErrors = {},
  onToggle,
  onAnswerChange,
  onAttachmentChange,
  onReadyChange,
  onCountChange,
}: ItemSectionProps) {
  const isContainer = product?.mode === "CONTAINER";
  const toast = useToast();

  const subFeatureDetailQuery = useSubFeatureQuery(
    isContainer && item.subFeatureId ? item.subFeatureId : null,
  );

  const templateFile = isContainer
    ? (subFeatureDetailQuery.data?.templateFile ?? null)
    : (product?.templateFile ?? null);

  const templateDownloadUrl = isContainer && item.subFeatureId
    ? subFeatureTemplateFileDownloadUrl(item.subFeatureId)
    : productTemplateFileDownloadUrl(item.productId);

  async function handleTemplateDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!templateFile) return;
    try {
      await downloadTemplateFile(templateDownloadUrl, templateFile.originalFilename);
    } catch {
      toast.error("Could not download the template file.");
    }
  }

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

  const [uploadingQids, setUploadingQids] = useState<Set<number>>(new Set());

  const requiredIds = questions.filter((q) => q.required).map((q) => q.id);
  const answeredRequired = requiredIds.filter(
    (qid) => (item.answers[qid] ?? "").trim() !== "",
  ).length;
  const docRequiredIds = questions.filter((q) => q.documentUploadRequired).map((q) => q.id);
  const docRequiredMet = docRequiredIds.filter((qid) => (item.attachments[qid]?.length ?? 0) > 0).length;
  const allRequiredAnswered =
    answeredRequired === requiredIds.length && docRequiredMet === docRequiredIds.length;

  const answeredCount = questions.filter((q) => {
    const textFilled = (item.answers[q.id] ?? "").trim() !== "";
    const docMet = !q.documentUploadRequired || (item.attachments[q.id]?.length ?? 0) > 0;
    return textFilled && docMet;
  }).length;

  async function handleFileSelect(q: QuestionListItem, file: File) {
    if (!item.itemId) return;
    const existing = item.attachments[q.id] ?? [];
    if (existing.some((a) => a.originalFilename === file.name && a.fileSizeBytes === file.size)) {
      toast.error(`"${file.name}" is already uploaded for this question.`);
      return;
    }
    setUploadingQids((prev) => new Set(prev).add(q.id));
    try {
      const meta = await uploadAnswerDocument(item.itemId, q.id, file);
      onAttachmentChange(q.id, meta);
    } catch {
      toast.error(`Could not upload "${file.name}". Check the file type and size (max 10 MB).`);
    } finally {
      setUploadingQids((prev) => { const s = new Set(prev); s.delete(q.id); return s; });
    }
  }

  async function handleFileRemove(attachmentId: number, qid: number) {
    try {
      await deleteAnswerDocument(attachmentId);
      onAttachmentChange(qid, null, attachmentId);
    } catch {
      // best-effort
    }
  }

  useEffect(() => {
    onReadyChange(allRequiredAnswered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRequiredAnswered]);

  const missingAnswers = requiredIds.length - answeredRequired;
  const missingFiles = docRequiredIds.length - docRequiredMet;

  useEffect(() => {
    onCountChange(answeredCount, questions.length, missingAnswers, missingFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, questions.length, missingAnswers, missingFiles]);

  return (
    <div
      className="bg-white rounded-lg"
      style={{
        border: `1px solid ${isOpen ? "var(--color-near-black)" : "var(--color-border)"}`,
        overflow: "hidden",
      }}
    >
      {/* Accordion header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center bg-transparent border-0 cursor-pointer text-left"
        style={{
          padding: "13px 18px",
          gap: 12,
          background: isOpen ? "#FBFBFA" : "#fff",
          borderBottom: isOpen ? "1px solid var(--color-warm-gray-light)" : "none",
        }}
      >
        {/* Status dot */}
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: isDone ? "var(--color-success)" : "#fff",
            border: isDone
              ? "none"
              : `1.5px solid ${isOpen ? "var(--color-near-black)" : "var(--color-border-strong)"}`,
          }}
        >
          {isDone ? (
            <Check style={{ width: 11, height: 11, color: "#fff" }} strokeWidth={3} />
          ) : isOpen ? (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--color-near-black)",
              }}
            />
          ) : null}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="text-near-black font-semibold" style={{ fontSize: 15 }}>
            {item.productName}
          </span>
          {item.subFeatureName && (
            <span className="text-warm-gray-med font-normal" style={{ fontSize: 14 }}>
              {" · "}
              {item.subFeatureName}
            </span>
          )}
          <div className="text-warm-gray-med" style={{ fontSize: 12, marginTop: 2 }}>
            {isDone
              ? "All required questions answered"
              : `${answeredCount} of ${questions.length} answered`}
          </div>
        </div>

        {templateFile && (
          <button
            type="button"
            onClick={handleTemplateDownload}
            className="flex items-center gap-1 shrink-0 rounded text-warm-gray-med hover:text-near-black"
            style={{
              fontSize: 12,
              padding: "3px 8px",
              border: "1px solid var(--color-border-strong)",
              background: "var(--color-warm-gray-light)",
              cursor: "pointer",
              lineHeight: 1.4,
            }}
            title={`Download template: ${templateFile.originalFilename}`}
          >
            <Download size={12} strokeWidth={1.5} />
            Template
          </button>
        )}

        <span className="text-warm-gray-med" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {answeredCount} / {questions.length}
        </span>

        <ChevronDown
          style={{
            width: 16,
            height: 16,
            color: isOpen ? "var(--fg-1)" : "var(--fg-2)",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 160ms ease",
            flexShrink: 0,
          }}
          strokeWidth={2}
        />
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div style={{ padding: "8px 24px 24px" }}>
          {questions.length === 0 ? (
            <p className="text-warm-gray-med" style={{ fontSize: 14, margin: "12px 0 0" }}>
              No questions for this product.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 0 }}>
              {questions.map((q) => (
                <li
                  key={q.id}
                  style={{
                    paddingTop: 18,
                    paddingBottom: 0,
                    borderTop: "1px solid var(--color-warm-gray-light)",
                    marginTop: 0,
                  }}
                >
                  <div className="flex items-baseline" style={{ gap: 8, marginBottom: 6 }}>
                    <span className="text-near-black font-medium" style={{ fontSize: 13 }}>
                      {q.questionText}
                    </span>
                    {q.required || q.documentUploadRequired ? (
                      <RequiredPill />
                    ) : (
                      <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
                        (optional)
                      </span>
                    )}
                  </div>
                  {q.helpText && (
                    <p className="text-warm-gray-med" style={{ fontSize: 12, margin: "0 0 6px" }}>
                      {q.helpText}
                    </p>
                  )}
                  <TypedAnswerInput
                    q={q}
                    inputId={`answer-${item.productId}-${item.subFeatureId ?? "null"}-${q.id}`}
                    value={item.answers[q.id] ?? ""}
                    onChange={(value) => onAnswerChange(q.id, value)}
                    error={fieldErrors[q.id]}
                  />
                  {q.documentUploadEnabled && (
                    <div style={{ marginTop: 10 }}>
                      {/* Uploaded file list */}
                      {(item.attachments[q.id] ?? []).length > 0 && (
                        <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 4, marginBottom: 8 }}>
                          {(item.attachments[q.id] ?? []).map((att) => (
                            <li
                              key={att.id}
                              className="flex items-center gap-2"
                              style={{
                                padding: "5px 10px",
                                background: "var(--color-warm-gray-light)",
                                borderRadius: 6,
                                fontSize: 13,
                              }}
                            >
                              <span className="text-near-black truncate flex-1">
                                {att.originalFilename}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleFileRemove(att.id, q.id)}
                                className="text-warm-gray-med hover:text-cardinal-red"
                                aria-label={`Remove ${att.originalFilename}`}
                                style={{ flexShrink: 0 }}
                              >
                                <X className="w-3.5 h-3.5" strokeWidth={2} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* Always-visible upload button */}
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            className="sr-only"
                            disabled={uploadingQids.has(q.id) || !item.itemId}
                            onChange={(e) => {
                              const file = e.currentTarget.files?.[0];
                              if (file) void handleFileSelect(q, file);
                              e.currentTarget.value = "";
                            }}
                          />
                          <span
                            className="inline-flex items-center gap-1.5 font-medium rounded cursor-pointer"
                            style={{
                              padding: "6px 14px",
                              fontSize: 13,
                              border: "1.5px solid var(--color-near-black)",
                              background: "var(--bg-surface)",
                              color: "var(--color-near-black)",
                              opacity: uploadingQids.has(q.id) || !item.itemId ? 0.5 : 1,
                            }}
                          >
                            {uploadingQids.has(q.id) ? "Uploading…" : "Choose file"}
                          </span>
                        </label>
                        <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                          {q.documentUploadRequired
                            ? <span style={{ color: "var(--fg-1)", fontWeight: 500 }}>Required</span>
                            : <span>Optional</span>
                          }
                          {" · "}PDF, Word, or Excel · max 10 MB
                        </span>
                      </div>
                    </div>
                  )}
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
  goLiveDate: string;
  goLiveDateUnknown: boolean;
  categoryName: string | null;
  programTypeNames: string[];
  clientName: string | null;
  programName: string | null;
  localItems: LocalItem[];
  products: ProductDetail[];
  requesterName: string;
  requestType: "CATALOG" | "INTAKE";
  submitting: boolean;
  onBack: () => void;
  onGoToStep1: () => void;
  onGoToStep2: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

function Step3({
  title,
  description,
  goLiveDate,
  goLiveDateUnknown,
  categoryName,
  programTypeNames,
  clientName,
  programName,
  localItems,
  products,
  requesterName,
  requestType,
  submitting,
  onBack,
  onGoToStep1,
  onGoToStep2,
  onSaveDraft,
  onSubmit,
}: Step3Props) {
  const [confirmed, setConfirmed] = useState(false);

  const formattedDate = useMemo(() => {
    if (goLiveDateUnknown || !goLiveDate) return null;
    const [y, m, d] = goLiveDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [goLiveDate, goLiveDateUnknown]);

  return (
    <>
      {/* Ready banner */}
      <div
        className="rounded-lg flex items-center"
        style={{
          padding: "16px 20px",
          background: "rgba(187, 221, 230, 0.18)",
          border: "1px solid rgba(187, 221, 230, 0.80)",
          marginBottom: 20,
          gap: 14,
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#fff",
            color: "#2C5666",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Check style={{ width: 18, height: 18 }} strokeWidth={2} />
        </span>
        <div>
          <div className="text-near-black font-semibold" style={{ fontSize: 15 }}>
            Everything looks ready to submit
          </div>
          <div className="text-warm-gray-med" style={{ fontSize: 13, marginTop: 2 }}>
            {requestType === "INTAKE"
              ? "Once submitted, Solution Owners will review your requirements and scope the work."
              : `${localItems.length} ${localItems.length === 1 ? "product" : "products"}. Once submitted, the estimating team will be notified and you can track progress on the request page.`}
          </div>
        </div>
      </div>

      {/* Estimate details */}
      <ReviewSection
        title="Estimate details"
        onEdit={onGoToStep1}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            gap: "10px 24px",
          }}
        >
          <KVRow label="Name" value={title} />
          {description && <KVRow label="Description" value={description} />}
          <KVRow label="Requested go live" value={formattedDate ?? "Unknown"} />
          {clientName && <KVRow label="Client" value={clientName} />}
          {programName && <KVRow label="Program" value={programName} />}
          {categoryName && <KVRow label="Category" value={categoryName} />}
          {programTypeNames.length > 0 && (
            <KVRow label="Program type" value={programTypeNames.join(", ")} />
          )}
          {requesterName && <KVRow label="Requested by" value={requesterName} />}
        </div>
      </ReviewSection>

      {/* Products & answers */}
      <ReviewSection
        title={requestType === "INTAKE" ? "Requirements & answers" : `Products & answers (${localItems.length})`}
        onEdit={onGoToStep2}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {localItems.map((item, i) => {
            const product = products.find((p) => p.id === item.productId) ?? null;
            return (
              <ItemReviewCard
                key={`${item.productId}-${item.subFeatureId ?? "null"}-${i}`}
                item={item}
                product={product}
                isFirst={i === 0}
              />
            );
          })}
        </div>
      </ReviewSection>

      {/* Inline confirmation */}
      <div
        className="rounded-lg"
        style={{
          padding: "18px 20px",
          border: "1px solid var(--color-border)",
          background: "#FBFBFA",
          marginBottom: 4,
        }}
      >
        <label className="flex items-start cursor-pointer" style={{ gap: 14 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.currentTarget.checked)}
            style={{
              width: 16,
              height: 16,
              marginTop: 2,
              flexShrink: 0,
              accentColor: "var(--color-near-black)",
              cursor: "pointer",
            }}
          />
          <div className="text-near-black" style={{ fontSize: 13, lineHeight: "18px" }}>
            <strong>
              {requestType === "INTAKE"
                ? "I confirm my requirements above are accurate."
                : "I confirm the products and answers above are accurate."}
            </strong>
            <br />
            {requestType === "INTAKE"
              ? "Once submitted, Solution Owners will review your requirements and begin scoping the estimate."
              : "Once submitted, the estimating team will receive this request and the product list cannot be changed. You can still track progress and comment on the request page."}
          </div>
        </label>
        {requestType === "CATALOG" && (
          <div
            className="flex items-center"
            style={{
              gap: 8,
              fontSize: 12,
              color: "var(--color-warning)",
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--color-warm-gray-light)",
            }}
          >
            <Lock style={{ width: 12, height: 12 }} strokeWidth={2} />
            Submitting will lock the product list. To change products later, start a new
            request.
          </div>
        )}
      </div>

      <FooterRow
        left={
          <TertiaryButton onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Back
          </TertiaryButton>
        }
      >
        <SecondaryButton disabled={submitting} onClick={onSaveDraft}>
          Save draft
        </SecondaryButton>
        <PrimaryButton disabled={submitting || !confirmed} onClick={onSubmit}>
          Submit estimate request
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PrimaryButton>
      </FooterRow>
    </>
  );
}

// =====================================================================
// Item review card (Step 3 — loads questions to display Q&A)
// =====================================================================

interface ItemReviewCardProps {
  item: LocalItem;
  product: ProductDetail | null;
  isFirst: boolean;
}

function ItemReviewCard({ item, product, isFirst }: ItemReviewCardProps) {
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

  return (
    <div
      style={{
        paddingTop: isFirst ? 0 : 16,
        marginTop: isFirst ? 0 : 0,
        borderTop: isFirst ? "none" : "1px solid var(--color-warm-gray-light)",
      }}
    >
      <div className="flex items-baseline" style={{ gap: 8, marginBottom: 10 }}>
        <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>
          {item.productName}
        </span>
        {item.subFeatureName && (
          <span className="text-warm-gray-med" style={{ fontSize: 13 }}>
            · {item.subFeatureName}
          </span>
        )}
      </div>

      {questions.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 24px",
          }}
        >
          {questions.map((q) => {
            const answer = (item.answers[q.id] ?? "").trim();
            const files = item.attachments[q.id] ?? [];
            return (
              <div
                key={q.id}
                style={{
                  padding: "6px 0",
                  gridColumn: answer.length > 60 ? "1 / -1" : undefined,
                }}
              >
                <div className="text-warm-gray-med" style={{ fontSize: 12 }}>
                  {q.questionText}
                </div>
                <AnswerValue
                  questionType={q.questionType}
                  answerText={answer}
                  emptyLabel="— No answer provided —"
                />
                {files.length > 0 && (
                  <div className="flex flex-col mt-1" style={{ gap: 2 }}>
                    {files.map((att) => (
                      <span key={att.id} className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--fg-2)" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {att.originalFilename}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-warm-gray-med" style={{ fontSize: 13, margin: 0 }}>
          No questions for this product.
        </p>
      )}
    </div>
  );
}

// =====================================================================
// Shared UI helpers
// =====================================================================

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-lg"
      style={{
        border: "1px solid var(--color-border)",
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "13px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#FBFBFA",
          borderBottom: "1px solid var(--color-warm-gray-light)",
        }}
      >
        <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>
          {title}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center text-near-black bg-transparent border-0 cursor-pointer"
          style={{ fontSize: 12, gap: 4, textDecoration: "none" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.textDecoration = "underline")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.textDecoration = "none")
          }
        >
          Edit
          <ArrowRight style={{ width: 11, height: 11 }} strokeWidth={2} />
        </button>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="text-warm-gray-med" style={{ fontSize: 12, paddingTop: 1 }}>
        {label}
      </div>
      <div className="text-near-black" style={{ fontSize: 14 }}>
        {value}
      </div>
    </>
  );
}

function FooterRow({
  children,
  left,
}: {
  children: React.ReactNode;
  left?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between bg-white"
      style={{
        gap: 8,
        marginTop: 24,
        paddingTop: 16,
        paddingBottom: 8,
        borderTop: "1px solid var(--color-warm-gray-light)",
        position: "sticky",
        bottom: 0,
        zIndex: 10,
      }}
    >
      <div>{left ?? null}</div>
      <div className="inline-flex items-center" style={{ gap: 8 }}>
        {children}
      </div>
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
