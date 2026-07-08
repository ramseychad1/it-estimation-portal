import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  History,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { ApiError } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ListToolbar } from "../../components/ListToolbar";
import { SearchInput } from "../../components/SearchInput";
import { FilterDropdown } from "../../components/FilterDropdown";
import { KebabMenu, type KebabMenuItem } from "../../components/KebabMenu";
import { StatusBadge } from "../../components/StatusBadge";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ColumnsToggle, useColumnsVisibility } from "../../components/ColumnsToggle";
import { DataTable, type DataTableColumn } from "../../components/data-table/DataTable";
import { PrimaryButton } from "../../components/buttons";
import { UserAvatar } from "../../components/UserAvatar";
import { RoleBadge } from "../../components/RoleBadge";
import { useToast } from "../../components/Toast";
import { relativeTime } from "../../lib/relativeTime";
import {
  getUser,
  type InvitationStatus,
  type UserDetail,
  type UserListItem,
  usersExportUrl,
} from "../../lib/api/users";
import {
  useActivateUserMutation,
  useDeactivateUserMutation,
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  useRevokeInvitationMutation,
  useUsersQuery,
} from "../../lib/queries/users";
import { InviteUserModal } from "./InviteUserModal";
import { InviteCreatedModal } from "./InviteCreatedModal";
import { ResetLinkModal } from "./ResetLinkModal";
import { EditUserDrawer } from "./EditUserDrawer";
import { PendingInviteDrawer } from "./PendingInviteDrawer";

type DrawerState =
  | { mode: "closed" }
  | { mode: "edit"; user: UserDetail }
  | { mode: "pending"; user: UserDetail; inviteUrl: string | null };

const PAGE_SIZE = 25;

const USERS_COLUMN_DEFS = [
  { key: "user", label: "User" },
  { key: "roles", label: "Roles" },
  { key: "teams", label: "Teams" },
  { key: "status", label: "Status" },
  { key: "lastActive", label: "Last active" },
  { key: "added", label: "Added" },
];
const USERS_REQUIRED_COLS = ["user"];

export function UsersPage() {
  useEffect(() => {
    document.title = "Users & Roles — Estimator";
  }, []);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteAdminPrefill, setInviteAdminPrefill] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{ userId: number; email: string; inviteUrl: string } | null>(null);
  const [resetLink, setResetLink] = useState<{ email: string; resetUrl: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDetail | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<UserDetail | null>(null);
  const [hiddenCols, setHiddenCols] = useColumnsVisibility("users", USERS_REQUIRED_COLS);

  const queryParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      role: roleFilter.length > 0 ? roleFilter.join(",") : undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      page,
      size: PAGE_SIZE,
    }),
    [search, roleFilter, statusFilter, page],
  );
  const usersQuery = useUsersQuery(queryParams);
  const items = usersQuery.data?.items ?? [];
  const totalElements = usersQuery.data?.totalElements ?? 0;
  const totalPages = usersQuery.data?.totalPages ?? 1;

  // Authoritative count from the server's meta field — independent of
  // pagination so the last-admin banner is correct on workspaces with
  // many admins. Falls back to 0 while loading; service-layer checks are
  // the real safety net for any blocking action.
  const activeAdminCount = usersQuery.data?.meta?.activeAdminCount ?? 0;

  const activateMutation = useActivateUserMutation();
  const deactivateMutation = useDeactivateUserMutation();
  const deleteMutation = useDeleteUserMutation();
  const resetPasswordMutation = useResetUserPasswordMutation();
  const revokeMutation = useRevokeInvitationMutation();
  const toast = useToast();

  async function openEdit(row: UserListItem) {
    try {
      const full = await getUser(row.id);
      if (full.invitationStatus === "PENDING_INVITE") {
        setDrawer({ mode: "pending", user: full, inviteUrl: null });
      } else {
        setDrawer({ mode: "edit", user: full });
      }
    } catch {
      toast.error("Could not load that user.");
    }
  }

  function buildKebab(row: UserListItem): KebabMenuItem[] {
    const isLastAdmin =
      row.invitationStatus === "ACTIVE"
      && row.roles.includes("Admin")
      && activeAdminCount <= 1;
    const isPending = row.invitationStatus === "PENDING_INVITE";
    const isInactive = row.invitationStatus === "INACTIVE";

    const items: KebabMenuItem[] = [
      {
        label: "Edit",
        icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => void openEdit(row),
      },
      {
        label: "View history",
        icon: <History className="w-3.5 h-3.5" strokeWidth={1.5} />,
        // History drawer reuses the standard text-only style; for now we
        // surface this link to the same place as Edit (inside the drawer).
        onSelect: () => void openEdit(row),
      },
      { kind: "divider" },
    ];

    if (isPending) {
      items.push({
        label: "Resend invite",
        icon: <Clock3 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () => void openEdit(row),
      });
    }

    if (row.invitationStatus === "ACTIVE") {
      items.push({
        label: "Reset password",
        icon: <KeyRound className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () =>
          resetPasswordMutation.mutate(row.id, {
            onSuccess: (res) => setResetLink({ email: row.email, resetUrl: res.resetUrl }),
            onError: () => toast.error("Could not reset that password."),
          }),
      });
      items.push({
        label: "Deactivate",
        icon: <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />,
        disabled: isLastAdmin,
        onSelect: () =>
          deactivateMutation.mutate(row.id, {
            onSuccess: () => toast.success(`${row.firstName} ${row.lastName} deactivated.`),
            onError: (err) => {
              const msg = err instanceof ApiError ? (err.body as { message?: string })?.message ?? "" : "";
              toast.error(msg || "Could not deactivate that user.");
            },
          }),
      });
    } else if (isInactive) {
      items.push({
        label: "Activate",
        icon: <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        onSelect: () =>
          activateMutation.mutate(row.id, {
            onSuccess: () => toast.success(`${row.firstName} ${row.lastName} activated.`),
            onError: () => toast.error("Could not activate that user."),
          }),
      });
    }

    // Delete is available for any non-pending user. The typed-name confirm
    // modal + last-admin protection do the deliberateness work; the modal
    // body steers admins toward Deactivate when the goal is just removing
    // sign-in access (audit history is preserved on deactivate; deletion
    // is permanent).
    if (!isPending) {
      items.push({
        label: "Delete user…",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        disabled: isLastAdmin,
        onSelect: () => void getUser(row.id).then((u) => setDeleteTarget(u)),
      });
    }

    return items;
  }

  const allColumns: DataTableColumn<UserListItem>[] = [
    {
      key: "user",
      header: "User",
      sortable: true,
      accessor: (r) => `${r.firstName} ${r.lastName}`,
      render: (r) => (
        <div className="flex items-center gap-3 py-1">
          <UserAvatar firstName={r.firstName} lastName={r.lastName} size={32} asButton={false} />
          <div className="min-w-0">
            {r.invitationStatus === "PENDING_INVITE" ? (
              <>
                <div className="font-medium text-near-black truncate" style={{ fontSize: 14 }}>{r.email}</div>
                <div className="text-warm-gray-med" style={{ fontSize: 12 }}>Invitation pending</div>
              </>
            ) : (
              <>
                <div className="font-medium text-near-black truncate" style={{ fontSize: 14 }}>
                  {r.firstName} {r.lastName}
                </div>
                <div className="text-warm-gray-med truncate" style={{ fontSize: 12 }}>{r.email}</div>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      width: 220,
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.roles.slice(0, 2).map((name) => <RoleBadge key={name} role={name} />)}
          {r.roles.length > 2 && (
            <span
              className="inline-flex items-center text-warm-gray-med"
              style={{ fontSize: 11, padding: "2px 6px", borderRadius: 999, background: "var(--color-warm-gray-light)" }}
            >
              +{r.roles.length - 2} more
            </span>
          )}
        </div>
      ),
    },
    {
      key: "teams",
      header: "Teams",
      width: 200,
      render: (r) => {
        const teams = r.teams ?? [];
        if (teams.length === 0) return <span className="text-warm-gray-med" style={{ fontSize: 12 }}>—</span>;
        const visible = teams.slice(0, 2);
        const overflow = teams.length - visible.length;
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {visible.map((t) => (
              <span
                key={t.id}
                className="text-warm-gray-med truncate"
                style={{ fontSize: 12 }}
              >
                {t.name}
              </span>
            ))}
            {overflow > 0 && (
              <span
                className="text-warm-gray-med"
                style={{ fontSize: 11, padding: "2px 6px", borderRadius: 999, background: "var(--color-warm-gray-light)" }}
              >
                +{overflow}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: 130,
      render: (r) => {
        if (r.invitationStatus === "ACTIVE") return <StatusBadge variant="active">Active</StatusBadge>;
        if (r.invitationStatus === "INACTIVE") return <StatusBadge variant="inactive">Inactive</StatusBadge>;
        return (
          <StatusBadge variant="warning" icon={<Clock3 className="w-3 h-3" strokeWidth={1.5} />}>
            Pending invite
          </StatusBadge>
        );
      },
    },
    {
      key: "lastActive",
      header: "Last active",
      sortable: true,
      width: 130,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {r.lastActiveAt ? relativeTime(r.lastActiveAt) : "—"}
        </span>
      ),
    },
    {
      key: "added",
      header: "Added",
      width: 130,
      render: (r) => (
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {relativeTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: 48,
      align: "right",
      preventRowClick: true,
      render: (r) => (
        <KebabMenu items={buildKebab(r)} ariaLabel={`Actions for ${r.firstName} ${r.lastName}`} />
      ),
    },
  ];

  const columns = allColumns.filter((c) => !hiddenCols.has(c.key));

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Users & roles" }]}
        title="Users & Roles"
        subtitle="Invite teammates, assign roles, and manage workspace access."
        actions={
          <PrimaryButton onClick={() => { setInviteAdminPrefill(false); setInviteOpen(true); }}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Invite User
          </PrimaryButton>
        }
      />

      <hr
        className="my-6"
        style={{ height: 1, background: "var(--color-warm-gray-light)", border: 0 }}
      />

      <ListToolbar>
        <SearchInput
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
        <FilterDropdown
          mode="multi"
          label="Role"
          value={roleFilter}
          options={[
            { value: "Admin", label: "Admin" },
            { value: "Solution Owner", label: "Solution Owner" },
            { value: "Estimator", label: "Estimator" },
            { value: "Requester", label: "Requester" },
          ]}
          onChange={(next) => { setRoleFilter(next); setPage(0); }}
        />
        <FilterDropdown
          mode="single"
          label="Status"
          value={statusFilter}
          options={[
            { value: "ALL", label: "All" },
            { value: "ACTIVE", label: "Active" },
            { value: "PENDING_INVITE", label: "Pending invite" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
          onChange={(next) => { setStatusFilter(next); setPage(0); }}
        />
        <ListToolbar.Spacer />
        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {totalElements === 1 ? "1 user" : `${totalElements} users`}
        </span>
        <ColumnsToggle
          storageKey="users"
          columns={USERS_COLUMN_DEFS}
          required={USERS_REQUIRED_COLS}
          hidden={hiddenCols}
          onChange={setHiddenCols}
        />
        <a
          href={usersExportUrl(queryParams)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-body font-medium text-near-black bg-white hover:bg-warm-gray-light"
          style={{ border: "1px solid var(--color-border-strong)", textDecoration: "none" }}
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          Export
        </a>
      </ListToolbar>

      <DataTable<UserListItem, number>
        columns={columns}
        rows={items}
        rowKey={(r) => r.id}
        loading={usersQuery.isLoading}
        ariaLabel="Users"
        onRowClick={(r) => void openEdit(r)}
        emptyState={
          <EmptyState
            variant="inline"
            title="No users match your filters"
            action={
              <button
                type="button"
                onClick={() => { setSearch(""); setRoleFilter([]); setStatusFilter("ALL"); setPage(0); }}
                className="text-near-black bg-transparent border-0 cursor-pointer hover:underline"
                style={{ fontSize: 13 }}
              >
                Reset filters
              </button>
            }
          />
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
            color: "var(--fg-2)",
            borderRadius: "0 0 6px 6px",
          }}
        >
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalElements)} of {totalElements}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="bg-white border rounded text-near-black disabled:text-warm-gray-med disabled:cursor-not-allowed"
              style={{ width: 28, height: 28, fontSize: 12, borderColor: "var(--color-border-strong)" }}
            >
              ‹
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="bg-white border rounded text-near-black disabled:text-warm-gray-med disabled:cursor-not-allowed"
              style={{ width: 28, height: 28, fontSize: 12, borderColor: "var(--color-border-strong)" }}
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* ---- modals + drawers --------------------------------------- */}

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={(result) => {
          setInviteOpen(false);
          setCreatedInvite({ userId: result.user.id, email: result.user.email, inviteUrl: result.inviteUrl });
        }}
        prefillAdmin={inviteAdminPrefill}
      />

      <InviteCreatedModal
        open={!!createdInvite}
        userId={createdInvite?.userId ?? 0}
        email={createdInvite?.email ?? ""}
        inviteUrl={createdInvite?.inviteUrl ?? ""}
        onDone={() => setCreatedInvite(null)}
      />

      <ResetLinkModal
        open={!!resetLink}
        email={resetLink?.email ?? ""}
        resetUrl={resetLink?.resetUrl ?? ""}
        onDone={() => setResetLink(null)}
      />

      <EditUserDrawer
        open={drawer.mode === "edit"}
        user={drawer.mode === "edit" ? drawer.user : null}
        activeAdminCount={activeAdminCount}
        onClose={() => setDrawer({ mode: "closed" })}
        onRequestDelete={(u) => setDeleteTarget(u)}
        onInviteAdmin={() => {
          setDrawer({ mode: "closed" });
          setInviteAdminPrefill(true);
          setInviteOpen(true);
        }}
      />

      <PendingInviteDrawer
        open={drawer.mode === "pending"}
        user={drawer.mode === "pending" ? drawer.user : null}
        inviteUrl={drawer.mode === "pending" ? drawer.inviteUrl : null}
        onClose={() => setDrawer({ mode: "closed" })}
        onRequestRevoke={(u) => setRevokeTarget(u)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Permanently delete ${deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : ""}?`}
        body={
          <>
            <p className="m-0">
              This permanently removes <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong> from the workspace. Their audit history is preserved but the user account cannot be restored.
            </p>
            {deleteTarget?.invitationStatus === "ACTIVE" && (
              <p className="m-0 mt-2" style={{ fontSize: 13 }}>
                <span className="text-warm-gray-med">If you only want to revoke sign-in access, </span>
                <strong className="text-near-black">Deactivate</strong>
                <span className="text-warm-gray-med"> instead — it's reversible and keeps the user's full record intact.</span>
              </p>
            )}
            <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 13 }}>
              Type the user's full name to confirm.
            </p>
          </>
        }
        confirmLabel="Permanently delete"
        destructive
        requireTypedConfirmation={
          deleteTarget
            ? { value: `${deleteTarget.firstName} ${deleteTarget.lastName}`, label: "Type the user's full name" }
            : undefined
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync({
              id: deleteTarget.id,
              confirmationName: `${deleteTarget.firstName} ${deleteTarget.lastName}`,
            });
            toast.success(`${deleteTarget.firstName} ${deleteTarget.lastName} deleted.`);
            setDeleteTarget(null);
            if (drawer.mode === "edit" && drawer.user.id === deleteTarget.id) {
              setDrawer({ mode: "closed" });
            }
          } catch (err) {
            const msg = err instanceof ApiError ? (err.body as { message?: string })?.message ?? "" : "";
            toast.error(msg || "Could not delete that user.");
          }
        }}
      />

      <ConfirmModal
        open={!!revokeTarget}
        title={`Revoke invitation for ${revokeTarget?.email ?? ""}?`}
        body={
          <p className="m-0">
            They won't be able to use the existing invitation link. You can re-invite them later.
          </p>
        }
        confirmLabel="Revoke invitation"
        destructive
        onCancel={() => setRevokeTarget(null)}
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revokeMutation.mutateAsync(revokeTarget.id);
            toast.success("Invitation revoked.");
            setRevokeTarget(null);
            if (drawer.mode === "pending" && drawer.user.id === revokeTarget.id) {
              setDrawer({ mode: "closed" });
            }
          } catch (err) {
            const msg = err instanceof ApiError ? (err.body as { message?: string })?.message ?? "" : "";
            toast.error(msg || "Could not revoke that invitation.");
          }
        }}
      />
    </>
  );
}
