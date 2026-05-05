import { Activity, Download } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { ListToolbar } from "../../components/ListToolbar";
import { SearchInput } from "../../components/SearchInput";
import { FilterDropdown } from "../../components/FilterDropdown";
import { Timeline } from "../../components/Timeline";
import {
  DateRangePicker,
  resolveRange,
  type DateRangeValue,
} from "../../components/DateRangePicker";
import {
  changeLogExportUrl,
  type ChangeAction,
  type ChangeLogGroup,
} from "../../lib/api/changeLog";
import {
  useChangeLogFilterOptionsQuery,
  useChangeLogQuery,
} from "../../lib/queries/changeLog";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { ChangeLogEntry } from "./ChangeLogEntry";

const PAGE_SIZE = 50;
const DEFAULT_RANGE: DateRangeValue = { preset: "last30" };

export function ChangeLogPage() {
  useEffect(() => {
    document.title = "Change Log — Estimator";
  }, []);

  const [search, setSearch] = useState("");
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<ChangeAction[]>([]);
  const [actorId, setActorId] = useState<string>(""); // "" === "All"
  const [range, setRange] = useState<DateRangeValue>(DEFAULT_RANGE);
  const [page, setPage] = useState(0);

  // Debounce only the search box. Dropdown / date changes apply immediately.
  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset to page 0 whenever any filter changes.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, entityTypes, actions, actorId, range]);

  const filtersQuery = useChangeLogFilterOptionsQuery();

  const { from, to } = useMemo(() => resolveRange(range), [range]);
  const queryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      entityTypes: entityTypes.length > 0 ? entityTypes.join(",") : undefined,
      actions: actions.length > 0 ? actions.join(",") : undefined,
      actorIds: actorId || undefined,
      from,
      to,
      page,
      size: PAGE_SIZE,
    }),
    [debouncedSearch, entityTypes, actions, actorId, from, to, page],
  );

  const feedQuery = useChangeLogQuery(queryParams);

  const groups = feedQuery.data?.groups ?? [];
  const totalElements = feedQuery.data?.totalElements ?? 0;
  const hasMore = feedQuery.data?.hasMore ?? false;

  const isFiltered =
    debouncedSearch !== "" ||
    entityTypes.length > 0 ||
    actions.length > 0 ||
    actorId !== "" ||
    range.preset !== "last30";

  function resetFilters() {
    setSearch("");
    setEntityTypes([]);
    setActions([]);
    setActorId("");
    setRange(DEFAULT_RANGE);
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Change log" }]}
        title="Change Log"
        subtitle="Every change made in this workspace, who made it, and when. The change log is read-only and cannot be edited."
        actions={
          <a
            href={changeLogExportUrl(queryParams)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-body font-medium text-near-black bg-white hover:bg-warm-gray-light"
            style={{ border: "1px solid var(--color-border-strong)" }}
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            Export
          </a>
        }
      />

      <div className="mt-6">
        <ListToolbar>
          <SearchInput
            placeholder="Search by entity, user, or change description…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            width={400}
          />
          <ListToolbar.Spacer />
          <DateRangePicker value={range} onChange={setRange} />
        </ListToolbar>

        <ListToolbar>
          <FilterDropdown
            mode="multi"
            label="Entity"
            value={entityTypes}
            options={filtersQuery.data?.entityTypes ?? []}
            onChange={setEntityTypes}
          />
          <FilterDropdown<ChangeAction>
            mode="multi"
            label="Action"
            value={actions}
            options={filtersQuery.data?.actions ?? []}
            onChange={setActions}
          />
          <FilterDropdown
            mode="single"
            label="User"
            value={actorId}
            options={[
              { value: "", label: "All" },
              ...((filtersQuery.data?.actors ?? []).map((a) => ({
                value: String(a.id),
                label: a.name,
              }))),
            ]}
            onChange={setActorId}
          />
          <ListToolbar.Spacer />
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {totalElements.toLocaleString()} {totalElements === 1 ? "change" : "changes"}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-warm-gray-med hover:text-near-black bg-transparent border-0 cursor-pointer"
              style={{ fontSize: 13 }}
            >
              Reset filters
            </button>
          )}
        </ListToolbar>

        {feedQuery.isLoading && groups.length === 0 ? (
          <div className="text-warm-gray-med text-small py-8 text-center">Loading…</div>
        ) : groups.length === 0 && !isFiltered ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="As you and your team make changes to products, teams, rates, and users, those changes will appear here."
          />
        ) : groups.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No changes match your filters"
            description="Try widening the date range or removing some filters."
            action={
              <button
                type="button"
                onClick={resetFilters}
                className="text-near-black bg-transparent border-0 cursor-pointer hover:underline"
                style={{ fontSize: 13 }}
              >
                Reset filters
              </button>
            }
          />
        ) : (
          <>
            <Feed
              groups={groups}
              onActorClick={(id) => setActorId(String(id))}
            />
            {hasMore && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center justify-center h-8 px-4 rounded-md font-medium text-near-black bg-white hover:bg-warm-gray-light"
                  style={{
                    border: "1px solid var(--color-border-strong)",
                    fontSize: 13,
                  }}
                >
                  Load more
                </button>
              </div>
            )}
            {!hasMore && groups.length > 0 && (
              <p
                className="text-center italic text-warm-gray-med"
                style={{ fontSize: 12, padding: "16px 0" }}
              >
                — End of change log —
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Feed({
  groups,
  onActorClick,
}: {
  groups: ChangeLogGroup[];
  onActorClick: (id: number) => void;
}) {
  // Group by date label ("Today", "Yesterday", "Apr 28", "March 2026").
  const buckets = useMemo(() => bucketByDate(groups), [groups]);

  return (
    <>
      {buckets.map((bucket) => (
        <section key={bucket.label} className="mb-6">
          <h2
            className="m-0 mb-2 text-near-black font-semibold"
            style={{ fontSize: 13 }}
          >
            {bucket.label}
          </h2>
          <hr
            className="m-0 mb-3 border-0"
            style={{ height: 1, background: "var(--color-warm-gray-light)" }}
          />
          <Timeline>
            {bucket.groups.map((group) => (
              <ChangeLogEntry
                key={group.id}
                group={group}
                onActorClick={onActorClick}
              />
            ))}
          </Timeline>
        </section>
      ))}
    </>
  );
}

interface DateBucket {
  label: string;
  groups: ChangeLogGroup[];
}

function bucketByDate(groups: ChangeLogGroup[]): DateBucket[] {
  const out = new Map<string, ChangeLogGroup[]>();
  for (const g of groups) {
    const label = labelForDate(new Date(g.changedAt));
    if (!out.has(label)) out.set(label, []);
    out.get(label)!.push(g);
  }
  return Array.from(out.entries()).map(([label, groups]) => ({ label, groups }));
}

function labelForDate(d: Date): string {
  const today = startOfLocalDay(new Date());
  const ymd = startOfLocalDay(d);
  const diffDays = Math.round((today.getTime() - ymd.getTime()) / (24 * 3600 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  if (today.getFullYear() === d.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
