import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ChangeLogChange, ChangeLogGroup } from "../../lib/api/changeLog";
import { TimelineItem } from "../../components/Timeline";
import { ValueBlock } from "../../components/ValueBlock";

interface ChangeLogEntryProps {
  group: ChangeLogGroup;
  /** Called when the user clicks the actor name (filters by that actor). */
  onActorClick?: (actorId: number) => void;
}

const HIGH_IMPACT_LABELS: Partial<Record<string, { label: string; color: string }>> = {
  DELETED: { label: "DELETED", color: "var(--color-cardinal-red)" },
  DEACTIVATED: { label: "DEACTIVATED", color: "var(--color-warm-gray-med)" },
};

export function ChangeLogEntry({ group, onActorClick }: ChangeLogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const time = formatTime(group.changedAt);
  const impact = HIGH_IMPACT_LABELS[group.action];

  function toggle() {
    setExpanded((v) => !v);
  }

  return (
    <TimelineItem avatar={<Avatar name={group.actor.name} />}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover:bg-warm-gray-light"
      >
        <span
          className="text-warm-gray-med tabular-nums"
          style={{ fontSize: 12, width: 80, flexShrink: 0 }}
        >
          {time}
        </span>
        <p className="m-0 flex-1 text-near-black" style={{ fontSize: 14 }}>
          {/* Render the description as the source of truth. The structured
              fields are used for the click handlers below. */}
          <ActorAndEntity
            group={group}
            onActorClick={onActorClick}
            onEntityClick={(href) => navigate(href)}
          />
        </p>
        <span
          className="inline-flex items-center px-2 rounded font-medium text-warm-gray-med"
          style={{
            fontSize: 11,
            height: 20,
            background: "var(--color-warm-gray-light)",
          }}
          title={group.entityType}
        >
          {entityTypeLabel(group.entityType)}
        </span>
        {impact && (
          <span
            className="font-semibold uppercase"
            style={{
              fontSize: 11,
              letterSpacing: "0.04em",
              color: impact.color,
            }}
          >
            {impact.label}
          </span>
        )}
        <ChevronRight
          className="w-4 h-4 text-warm-gray-med"
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
          }}
          strokeWidth={1.5}
        />
      </div>
      {expanded && <ExpandedPanel group={group} />}
    </TimelineItem>
  );
}

function ActorAndEntity({
  group,
  onActorClick,
  onEntityClick,
}: {
  group: ChangeLogGroup;
  onActorClick?: (id: number) => void;
  onEntityClick?: (href: string) => void;
}) {
  // The description string is "Actor verb Type 'Entity Name'", or a self-
  // action variant like "Sarah accepted their invitation". We re-derive the
  // pieces from structured fields so actor / entity name can be clickable
  // without relying on string parsing.
  const actorName = group.actor.name;
  const entityLabel = entityTypeLabel(group.entityType);
  const verb = inferVerb(group);

  // Self-action: render whole thing as plain text (it's a single-noun phrase).
  if (isSelfAction(group)) {
    return <span>{group.description}</span>;
  }

  return (
    <span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (group.actor.id != null) onActorClick?.(group.actor.id);
        }}
        className="font-semibold text-near-black bg-transparent border-0 p-0 cursor-pointer hover:underline"
        style={{ fontSize: 14 }}
      >
        {actorName}
      </button>{" "}
      <span className="text-warm-gray-med">
        {verb} {entityLabel}
      </span>{" "}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!group.entityDeleted && group.viewEntityHref) onEntityClick?.(group.viewEntityHref);
        }}
        disabled={group.entityDeleted || !group.viewEntityHref}
        className="text-near-black bg-transparent border-0 p-0 cursor-pointer hover:underline disabled:cursor-default disabled:hover:no-underline"
        style={{ fontSize: 14 }}
      >
        '{group.entityName}'
      </button>
    </span>
  );
}

function ExpandedPanel({ group }: { group: ChangeLogGroup }) {
  return (
    <div
      className="ml-2 mb-3 rounded-md"
      style={{
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border)",
        padding: "12px 14px",
      }}
    >
      {group.action === "UPDATED" && group.changes.length > 0 ? (
        <UpdatedVariant changes={group.changes} />
      ) : group.action === "DELETED" ? (
        <DeletedVariant />
      ) : group.action === "CREATED" ? (
        <CreatedVariant />
      ) : null /* simple variant uses metadata only — rendered below */}
      <Metadata group={group} />
      {!group.entityDeleted && group.viewEntityHref && (
        <a
          href={group.viewEntityHref}
          className="inline-block mt-2 text-near-black hover:underline"
          style={{ fontSize: 12 }}
        >
          View entity →
        </a>
      )}
    </div>
  );
}

function UpdatedVariant({ changes }: { changes: ChangeLogChange[] }) {
  return (
    <div className="mb-3">
      <SectionHeader label="Changes" />
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {changes.map((c) => (
          <li key={c.field} className="flex items-start gap-2" style={{ fontSize: 12 }}>
            <span
              className="uppercase font-medium text-warm-gray-med"
              style={{ width: 100, flexShrink: 0, paddingTop: 6, fontSize: 11, letterSpacing: "0.04em" }}
            >
              {humanizeField(c.field)}
            </span>
            <ValueBlock value={c.oldValue} variant="before" />
            <span className="text-warm-gray-med self-center" style={{ fontSize: 14 }}>
              →
            </span>
            <ValueBlock value={c.newValue} variant="after" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreatedVariant() {
  return (
    <p
      className="m-0 mb-2 italic text-warm-gray-med"
      style={{ fontSize: 12 }}
    >
      Detailed history not available for this CREATED action. View the entity
      to see its current values, or see subsequent UPDATED entries below for
      what's changed since.
    </p>
  );
}

function DeletedVariant() {
  return (
    <>
      <div
        className="flex items-start gap-2 mb-3 rounded-md"
        style={{
          padding: "10px 12px",
          background: "rgba(196, 18, 48, 0.06)",
          border: "1px solid rgba(196, 18, 48, 0.2)",
        }}
      >
        <span
          aria-hidden="true"
          className="font-bold"
          style={{ color: "var(--color-cardinal-red)" }}
        >
          ⚠
        </span>
        <p className="m-0 text-near-black" style={{ fontSize: 12 }}>
          This entity has been deleted. Detailed history not available for
          this DELETED action; see prior UPDATED entries above for what was
          changed before deletion.
        </p>
      </div>
    </>
  );
}

function Metadata({ group }: { group: ChangeLogGroup }) {
  return (
    <div>
      <SectionHeader label="Metadata" />
      <dl className="m-0 grid grid-cols-2 gap-y-1" style={{ fontSize: 12 }}>
        <dt className="text-warm-gray-med">Changed at</dt>
        <dd className="m-0 text-near-black">{formatFullTimestamp(group.changedAt)}</dd>
        <dt className="text-warm-gray-med">Changed by</dt>
        <dd className="m-0 text-near-black">{group.actor.name}</dd>
        <dt className="text-warm-gray-med">Source</dt>
        <dd className="m-0 text-near-black">{sourceLabel(group.source)}</dd>
      </dl>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p
      className="m-0 mb-1 uppercase font-medium text-warm-gray-med"
      style={{ fontSize: 11, letterSpacing: "0.06em" }}
    >
      {label}
    </p>
  );
}

function Avatar({ name }: { name: string }) {
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0][0].toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "var(--color-near-black)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {initials}
    </span>
  );
}

// ---- helpers --------------------------------------------------------------

function entityTypeLabel(type: string): string {
  switch (type) {
    case "Team":
      return "Team";
    case "SdlcPhase":
      return "SDLC Phase";
    case "BlendedRate":
      return "Blended Rate";
    case "User":
      return "User";
    default:
      return type;
  }
}

function inferVerb(group: ChangeLogGroup): string {
  switch (group.action) {
    case "CREATED":
      return "created";
    case "UPDATED":
      return "updated";
    case "ACTIVATED":
      return "activated";
    case "DEACTIVATED":
      return "deactivated";
    case "DELETED":
      return "deleted";
    case "REORDERED":
      return "reordered";
    case "PASSWORD_RESET":
      return "reset password for";
    case "INVITATION_REVOKED":
      return "revoked invitation for";
    case "INVITATION_ACCEPTED":
      return "accepted invitation as";
  }
}

function isSelfAction(group: ChangeLogGroup): boolean {
  return (
    group.entityType === "User" &&
    group.actor.id != null &&
    group.actor.id === group.entityId
  );
}

function humanizeField(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceLabel(source: string): string {
  if (source === "WEB") return "Web app";
  return source;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatFullTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
