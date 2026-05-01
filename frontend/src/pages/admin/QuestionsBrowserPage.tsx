import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { ListToolbar } from "../../components/ListToolbar";
import { SearchInput } from "../../components/SearchInput";
import { FilterDropdown } from "../../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../../components/KebabMenu";
import { StatusBadge } from "../../components/StatusBadge";
import { ColumnsToggle, useColumnsVisibility } from "../../components/ColumnsToggle";
import { DataTable, type DataTableColumn } from "../../components/data-table/DataTable";
import { SecondaryButton } from "../../components/buttons";
import { UserCell } from "../../components/UserCell";
import { EmptyState } from "../../components/EmptyState";
import { useToast } from "../../components/Toast";
import { relativeTime } from "../../lib/relativeTime";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import {
  useAllQuestionsQuery,
  useDeleteQuestionMutation,
} from "../../lib/queries/questions";
import { ConfirmModal } from "../../components/ConfirmModal";
import {
  getQuestion,
  type QuestionDetail,
  type QuestionListItem,
  type QuestionParentType,
} from "../../lib/api/questions";
import { AddQuestionDrawer, type QuestionDrawerParent } from "./products/AddQuestionDrawer";

const PAGE_SIZE = 25;

const QUESTIONS_COLUMN_DEFS = [
  { key: "questionText", label: "Question" },
  { key: "parent", label: "Parent" },
  { key: "required", label: "Required" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Last updated" },
  { key: "updatedBy", label: "Updated by" },
];
const QUESTIONS_REQUIRED_COLS = ["questionText"];

export function QuestionsBrowserPage() {
  useEffect(() => {
    document.title = "Critical questions — Estimator";
  }, []);

  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [parentType, setParentType] = useState<"" | QuestionParentType>("");
  const [requiredFilter, setRequiredFilter] =
    useState<"ALL" | "REQUIRED" | "OPTIONAL">("ALL");
  const [statusFilter, setStatusFilter] =
    useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(0);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility(
    "questions-browser",
    QUESTIONS_REQUIRED_COLS,
  );
  const [editTarget, setEditTarget] = useState<QuestionDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionListItem | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset page on filter change.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, parentType, requiredFilter, statusFilter]);

  const queryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      parentType: (parentType || undefined) as QuestionParentType | undefined,
      required: requiredFilter,
      status: statusFilter,
      page,
      size: PAGE_SIZE,
      sort: "questionText,asc",
    }),
    [debouncedSearch, parentType, requiredFilter, statusFilter, page],
  );

  const questionsQuery = useAllQuestionsQuery(queryParams);
  const deleteMutation = useDeleteQuestionMutation();

  const items = questionsQuery.data?.items ?? [];
  const totalElements = questionsQuery.data?.totalElements ?? 0;
  const totalPages = questionsQuery.data?.totalPages ?? 1;
  const hasFilter =
    !!debouncedSearch.trim() ||
    parentType !== "" ||
    requiredFilter !== "ALL" ||
    statusFilter !== "ALL";

  function resetFilters() {
    setSearch("");
    setParentType("");
    setRequiredFilter("ALL");
    setStatusFilter("ALL");
    setPage(0);
  }

  async function openEditDrawer(row: QuestionListItem) {
    try {
      const full = await getQuestion(row.id);
      setEditTarget(full);
    } catch {
      toast.error("Could not load that question.");
    }
  }

  function openParentDetail(row: QuestionListItem) {
    if (row.parentType === "Product") {
      navigate(`/catalog/products/${row.parentId}`);
    } else if (row.grandparentProductId != null) {
      navigate(`/catalog/products/${row.grandparentProductId}/sub-features/${row.parentId}`);
    }
  }

  function buildKebab(row: QuestionListItem): KebabMenuItem[] {
    return [
      {
        label: "Open in parent",
        onSelect: () => openParentDetail(row),
      },
      {
        label: "Edit",
        icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => void openEditDrawer(row),
      },
      { kind: "divider" },
      {
        label: "Delete",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        onSelect: () => setDeleteTarget(row),
      },
    ];
  }

  const allColumns: DataTableColumn<QuestionListItem>[] = [
    {
      key: "questionText",
      header: "Question",
      sortable: true,
      render: (r) => (
        <span
          className="font-semibold text-near-black"
          style={{
            display: "inline-block",
            maxWidth: 480,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={r.questionText}
        >
          {r.questionText}
        </span>
      ),
    },
    {
      key: "parent",
      header: "Parent",
      width: 260,
      render: (r) => (
        <div className="flex items-center gap-2">
          <ParentTypePill parentType={r.parentType} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openParentDetail(r);
            }}
            className="text-near-black bg-transparent border-0 p-0 cursor-pointer hover:underline"
            style={{ fontSize: 13 }}
          >
            {r.parentName}
          </button>
        </div>
      ),
      preventRowClick: false,
    },
    {
      key: "required",
      header: "Required",
      width: 100,
      render: (r) => <RequiredPill required={r.required} />,
    },
    {
      key: "status",
      header: "Status",
      width: 100,
      render: (r) => (
        <StatusBadge variant={r.active ? "active" : "inactive"}>
          {r.active ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      key: "updatedAt",
      header: "Last updated",
      width: 130,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {r.updatedAt ? relativeTime(r.updatedAt) : "—"}
        </span>
      ),
    },
    {
      key: "updatedBy",
      header: "Updated by",
      width: 160,
      render: (r) => <UserCell userId={r.updatedBy} />,
    },
    {
      key: "actions",
      header: "",
      width: 48,
      preventRowClick: true,
      render: (r) => <KebabMenu items={buildKebab(r)} />,
    },
  ];
  const columns = allColumns.filter((c) => !hiddenCols.has(c.key) || c.key === "actions");

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Catalog" }, { label: "Critical questions" }]}
        title="Critical questions"
        subtitle="Questions asked of requesters before estimate generation, across the catalog."
      />

      <div className="mt-6">
        <ListToolbar>
          <SearchInput
            placeholder="Search question text…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            width={320}
          />
          <FilterDropdown
            mode="single"
            label="Parent type"
            value={parentType}
            options={[
              { value: "", label: "All" },
              { value: "Product", label: "Product" },
              { value: "SubFeature", label: "Sub-feature" },
            ]}
            onChange={(v) => setParentType(v as "" | QuestionParentType)}
          />
          <FilterDropdown
            mode="single"
            label="Required"
            value={requiredFilter}
            options={[
              { value: "ALL", label: "All" },
              { value: "REQUIRED", label: "Required" },
              { value: "OPTIONAL", label: "Optional" },
            ]}
            onChange={(v) => setRequiredFilter(v as "ALL" | "REQUIRED" | "OPTIONAL")}
          />
          <FilterDropdown
            mode="single"
            label="Status"
            value={statusFilter}
            options={[
              { value: "ALL", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            onChange={(v) => setStatusFilter(v as "ALL" | "ACTIVE" | "INACTIVE")}
          />
          <ListToolbar.Spacer />
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {totalElements} {totalElements === 1 ? "question" : "questions"}
          </span>
          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-warm-gray-med hover:text-near-black bg-transparent border-0 cursor-pointer"
              style={{ fontSize: 13 }}
            >
              Reset filters
            </button>
          )}
          <ColumnsToggle
            storageKey="questions-browser"
            columns={QUESTIONS_COLUMN_DEFS}
            required={QUESTIONS_REQUIRED_COLS}
            hidden={hiddenCols}
            onChange={setHiddenCols}
          />
        </ListToolbar>

        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={questionsQuery.isLoading}
          ariaLabel="Critical questions"
          // Row click opens the EDIT drawer rather than navigating —
          // questions don't have detail pages of their own.
          onRowClick={(r) => void openEditDrawer(r)}
          emptyState={
            hasFilter ? (
              <EmptyState
                variant="inline"
                title="No questions match your filters"
                action={
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-near-black underline bg-transparent border-0 cursor-pointer"
                    style={{ fontSize: 13 }}
                  >
                    Reset filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="No critical questions yet"
                description="Questions are added inside a Product or Sub-feature. Open a parent to add the first one."
              />
            )
          }
        />

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between mt-3"
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--color-warm-gray-light)",
              background: "#FBFBFA",
              fontSize: 12,
            }}
          >
            <span className="text-warm-gray-med">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <SecondaryButton
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </SecondaryButton>
              <SecondaryButton
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>

      <AddQuestionDrawer
        open={!!editTarget}
        parent={editTarget ? parentRefFor(editTarget) : null}
        question={editTarget}
        onClose={() => setEditTarget(null)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this question?"
        body={
          deleteTarget && (
            <>
              <p className="m-0" style={{ fontSize: 14 }}>
                <em>"{deleteTarget.questionText}"</em>
              </p>
              <p
                className="m-0 mt-2"
                style={{ fontSize: 13, color: "var(--color-warm-gray-med)" }}
              >
                This question will be removed from <strong>'{deleteTarget.parentName}'</strong>. This action cannot be undone.
              </p>
            </>
          )
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            toast.success("Question deleted.");
          } catch {
            toast.error("Could not delete that question.");
          }
          setDeleteTarget(null);
        }}
        confirmLabel="Delete question"
        destructive
      />
    </>
  );
}

function parentRefFor(q: QuestionDetail): QuestionDrawerParent {
  return q.parentType === "Product"
    ? { kind: "Product", id: q.parentId, name: q.parentName }
    : { kind: "SubFeature", id: q.parentId, name: q.parentName };
}

function ParentTypePill({ parentType }: { parentType: QuestionParentType }) {
  const isProduct = parentType === "Product";
  return (
    <span
      data-testid={`parent-type-pill-${parentType.toLowerCase()}`}
      className="inline-flex items-center text-near-black"
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: isProduct ? "var(--color-light-blue-soft)" : "var(--color-warm-gray-light)",
        border: isProduct
          ? "1px solid rgba(187,221,230,0.7)"
          : "1px solid var(--color-border-strong)",
      }}
    >
      {isProduct ? "Product" : "Sub-feature"}
    </span>
  );
}

function RequiredPill({ required }: { required: boolean }) {
  if (required) {
    return (
      <span
        className="inline-flex items-center"
        style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          background: "var(--color-white)",
          color: "var(--color-cardinal-red)",
          border: "1px solid var(--color-cardinal-red)",
        }}
      >
        Required
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center text-warm-gray-med"
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border-strong)",
      }}
    >
      Optional
    </span>
  );
}
