import { Drawer } from "../../components/Drawer";
import { StatusBadge } from "../../components/StatusBadge";
import { UserCell } from "../../components/UserCell";
import { TertiaryButton, SecondaryButton } from "../../components/buttons";
import { formatDelta, formatMoney } from "../../lib/money";
import type { BlendedRateListItem } from "../../lib/api/rates";

interface RateDetailsDrawerProps {
  open: boolean;
  rate: BlendedRateListItem | null;
  /** The rate row immediately preceding this one in effective-date order. */
  previous: BlendedRateListItem | null;
  onClose: () => void;
  /** Triggers the Update Rates modal pre-filled with this row's values. */
  onRevert?: (rate: BlendedRateListItem) => void;
}

function isoToHuman(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timestampToHuman(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RateDetailsDrawer({
  open,
  rate,
  previous,
  onClose,
  onRevert,
}: RateDetailsDrawerProps) {
  if (!rate) return <Drawer open={open} onClose={onClose} title="Rate change">{null}</Drawer>;

  const onshoreDelta = previous
    ? formatDelta(Number(previous.onshoreRate), Number(rate.onshoreRate))
    : null;
  const offshoreDelta = previous
    ? formatDelta(Number(previous.offshoreRate), Number(rate.offshoreRate))
    : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Rate change — ${isoToHuman(rate.effectiveDate)}`}
      footer={
        <>
          <div>
            {onRevert && (
              <TertiaryButton onClick={() => onRevert(rate)}>
                Revert to this rate
              </TertiaryButton>
            )}
          </div>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        </>
      }
    >
      <DetailRow label="Effective date">
        <span>{isoToHuman(rate.effectiveDate)}</span>
        {rate.current && <StatusBadge variant="active">Current</StatusBadge>}
        {rate.scheduled && <StatusBadge variant="neutral">Scheduled</StatusBadge>}
      </DetailRow>

      <DetailRow label="Onshore rate">
        <span className="tabular font-semibold" style={{ fontSize: 18 }}>
          ${formatMoney(rate.onshoreRate)}
        </span>
        {onshoreDelta && (
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {onshoreDelta.text} from previous
          </span>
        )}
      </DetailRow>

      <DetailRow label="Offshore rate">
        <span className="tabular font-semibold" style={{ fontSize: 18 }}>
          ${formatMoney(rate.offshoreRate)}
        </span>
        {offshoreDelta && (
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {offshoreDelta.text} from previous
          </span>
        )}
      </DetailRow>

      <DetailRow label="Changed by">
        <UserCell userId={rate.createdBy} />
      </DetailRow>

      <DetailRow label="Changed on">
        <span style={{ fontSize: 14 }}>{timestampToHuman(rate.createdAt)}</span>
      </DetailRow>

      {rate.note && (
        <DetailRow label="Note">
          <blockquote
            className="m-0 mt-1"
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--fg-1)",
              lineHeight: "20px",
              background: "var(--color-warm-gray-light)",
              borderLeft: "4px solid var(--color-light-blue)",
              padding: "10px 12px",
              borderRadius: "0 4px 4px 0",
            }}
          >
            {rate.note}
          </blockquote>
        </DetailRow>
      )}

      <div className="mt-4">
        <div
          className="text-warm-gray-med uppercase font-medium mb-2"
          style={{ fontSize: 11, letterSpacing: "0.06em" }}
        >
          Activity
        </div>
        <ul className="m-0 p-0" style={{ listStyle: "none" }}>
          <ActivityItem
            text={
              <>
                <UserCell userId={rate.createdBy} /> updated blended rates
              </>
            }
            time={timestampToHuman(rate.createdAt)}
          />
          <ActivityItem
            text={
              <>
                Rates {rate.scheduled ? "will become" : "became"} effective
              </>
            }
            time={isoToHuman(rate.effectiveDate)}
          />
        </ul>
      </div>
    </Drawer>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--color-warm-gray-light)",
      }}
    >
      <span
        className="text-warm-gray-med uppercase font-medium"
        style={{ fontSize: 11, letterSpacing: "0.06em" }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-2 text-near-black">{children}</div>
    </div>
  );
}

function ActivityItem({
  text,
  time,
}: {
  text: React.ReactNode;
  time: string;
}) {
  return (
    <li className="flex items-start gap-2.5" style={{ padding: "10px 0" }}>
      <span
        aria-hidden="true"
        className="flex-none"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--color-light-blue)",
          marginTop: 6,
        }}
      />
      <div className="flex-1">
        <div className="text-near-black" style={{ fontSize: 13, lineHeight: "18px" }}>
          {text}
        </div>
        <div className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {time}
        </div>
      </div>
    </li>
  );
}
