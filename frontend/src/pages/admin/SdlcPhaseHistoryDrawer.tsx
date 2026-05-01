import { Drawer } from "../../components/Drawer";
import { UserCell } from "../../components/UserCell";
import { usePhaseHistoryQuery } from "../../lib/queries/phases";
import { relativeTime } from "../../lib/relativeTime";

interface SdlcPhaseHistoryDrawerProps {
  open: boolean;
  phaseId: number | null;
  phaseName?: string;
  onClose: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  CREATED: "Created",
  UPDATED: "Changed",
  ACTIVATED: "Activated",
  DEACTIVATED: "Deactivated",
  DELETED: "Deleted",
  REORDERED: "Reordered",
};

export function SdlcPhaseHistoryDrawer({
  open,
  phaseId,
  phaseName,
  onClose,
}: SdlcPhaseHistoryDrawerProps) {
  const { data, isLoading, isError } = usePhaseHistoryQuery(open ? phaseId : null);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={phaseName ? `History — ${phaseName}` : "History"}
      subtitle="A record of every change made to this phase."
    >
      {isLoading && <p className="text-warm-gray-med text-body">Loading history…</p>}
      {isError && (
        <p className="text-cardinal-red text-body" role="alert">
          Could not load history.
        </p>
      )}
      {data && data.length === 0 && (
        <p className="text-warm-gray-med text-body">No history yet.</p>
      )}
      {data && data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1"
              style={{
                borderLeft: "2px solid var(--color-warm-gray-light)",
                paddingLeft: 12,
              }}
            >
              <div className="flex items-center gap-2 text-near-black" style={{ fontSize: 13 }}>
                <UserCell userId={entry.changedBy} />
                <span className="text-warm-gray-med">·</span>
                <span className="font-medium">{ACTION_LABEL[entry.action] ?? entry.action}</span>
                {entry.fieldName && (
                  <>
                    <span className="text-warm-gray-med">·</span>
                    <span className="text-warm-gray-med">{entry.fieldName}</span>
                  </>
                )}
              </div>
              {(entry.action === "UPDATED" || entry.action === "REORDERED") && (
                <div className="text-warm-gray-med" style={{ fontSize: 12 }}>
                  <span className="line-through">{entry.oldValue ?? "—"}</span>
                  {" → "}
                  <span className="text-near-black">{entry.newValue ?? "—"}</span>
                </div>
              )}
              <div className="text-warm-gray-med" style={{ fontSize: 11 }}>
                {relativeTime(entry.changedAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
