import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, MoreHorizontal, Shield, ShieldOff, Trash2, Loader2, UserPlus, X, Clock } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import {
  listAdminUsers,
  setUserRole,
  deleteAppUser,
  createAppUser,
  setUserAccessExpiry,
  type AdminUserRow,
} from "@/lib/admin-users.functions";

type Role = "admin" | "user";

export const Route = createFileRoute("/dashboard/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const isDark = useIsDark();
  const fetchUsers = useServerFn(listAdminUsers);
  const changeRole = useServerFn(setUserRole);
  const removeUser = useServerFn(deleteAppUser);
  const createUser = useServerFn(createAppUser);
  const changeExpiry = useServerFn(setUserAccessExpiry);
  const [showCreate, setShowCreate] = useState(false);
  const [expiryTarget, setExpiryTarget] = useState<AdminUserRow | null>(null);

  const panel = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const inputCls =
    "h-10 w-full rounded-md border pl-9 pr-3 text-sm outline-none transition-colors " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-700");
  const selectCls =
    "h-10 rounded-md border px-3 text-sm outline-none transition-colors " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 focus:border-emerald-700");

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"todas" | Role>("todas");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUsers({});
      if (!res.ok) throw new Error(res.error ?? "Erro");
      setUsers(res.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [fetchUsers]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "todas" && u.role !== roleFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const name = (u.name ?? "").toLowerCase();
        if (!name.includes(q) && !u.email.toLowerCase().includes(q) && !u.id.includes(q)) return false;
      }
      return true;
    });
  }, [users, query, roleFilter]);

  const handleToggleAdmin = useCallback(async (u: AdminUserRow) => {
    const next: Role = u.role === "admin" ? "user" : "admin";
    if (!confirm(`Confirmar: tornar "${u.email}" ${next === "admin" ? "administrador" : "usuário comum"}?`)) return;
    setBusyId(u.id); setOpenMenu(null);
    const res = await changeRole({ data: { targetId: u.id, role: next } });
    setBusyId(null);
    if (!res.ok) { alert(res.error ?? "Erro"); return; }
    setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, role: next } : x)));
  }, [changeRole]);

  const handleDelete = useCallback(async (u: AdminUserRow) => {
    if (!confirm(`Excluir definitivamente ${u.email}? Essa ação não pode ser desfeita.`)) return;
    setBusyId(u.id); setOpenMenu(null);
    const res = await removeUser({ data: { targetId: u.id } });
    setBusyId(null);
    if (!res.ok) { alert(res.error ?? "Erro"); return; }
    setUsers((cur) => cur.filter((x) => x.id !== u.id));
  }, [removeUser]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Usuários</h2>
          <p className={`text-xs ${muted} mt-0.5`}>
            {users.length} usuário{users.length !== 1 && "s"} cadastrado{users.length !== 1 && "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="h-10 px-4 rounded-md text-sm font-medium inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Novo usuário
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className={
              "h-10 px-4 rounded-md border text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-60 " +
              (isDark
                ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          isDark={isDark}
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            const res = await createUser({ data: payload });
            if (!res.ok) return res.error ?? "Erro ao criar usuário";
            await load();
            return null;
          }}
        />
      )}

      <div className={`rounded-xl border p-4 ${panel}`}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search className={"absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 " + (isDark ? "text-neutral-500" : "text-neutral-400")} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail ou ID..."
              className={inputCls}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className={selectCls}
          >
            <option value="todas">Todas as funções</option>
            <option value="admin">Administradores</option>
            <option value="user">Usuários</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm p-4">
          {error}
        </div>
      )}

      <div className={`rounded-xl border overflow-hidden ${panel}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={"text-xs uppercase tracking-wide " + (isDark ? "bg-neutral-950/50 text-neutral-500" : "bg-neutral-50 text-neutral-500")}>
              <tr>
                <th className="text-left font-medium px-4 py-3">Usuário</th>
                <th className="text-left font-medium px-4 py-3">Função</th>
                <th className="text-left font-medium px-4 py-3">Cadastro</th>
                <th className="text-left font-medium px-4 py-3">Último acesso</th>
                <th className="text-right font-medium px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className={`text-center py-12 ${muted}`}>Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className={`text-center py-12 ${muted}`}>Nenhum usuário encontrado.</td></tr>
              )}
              {!loading && filtered.map((u) => (
                <tr key={u.id} className={"border-t transition-colors " + (isDark ? "border-neutral-800 hover:bg-neutral-800/40" : "border-neutral-200 hover:bg-neutral-50")}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-xs font-semibold">
                        {initials(u.name ?? u.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name ?? "—"}</div>
                        <div className={`text-xs truncate ${muted}`}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><RoleBadge role={u.role} /></td>
                  <td className={`px-4 py-4 ${muted}`}>{formatDate(u.created_at)}</td>
                  <td className={`px-4 py-4 ${muted}`}>{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "—"}</td>
                  <td className="px-4 py-4 text-right relative">
                    {busyId === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin inline-block text-emerald-500" />
                    ) : (
                      <button
                        onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                        className={"h-8 w-8 rounded-md inline-flex items-center justify-center " + (isDark ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-100 text-neutral-500")}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                    {openMenu === u.id && (
                      <div
                        className={"absolute right-4 top-12 z-10 min-w-[200px] rounded-md border shadow-lg text-left text-sm " + (isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200")}
                        onMouseLeave={() => setOpenMenu(null)}
                      >
                        <button
                          onClick={() => void handleToggleAdmin(u)}
                          className={"w-full px-3 py-2 flex items-center gap-2 " + (isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-50")}
                        >
                          {u.role === "admin" ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                          {u.role === "admin" ? "Remover admin" : "Tornar admin"}
                        </button>
                        <button
                          onClick={() => void handleDelete(u)}
                          className="w-full px-3 py-2 flex items-center gap-2 text-red-500 hover:bg-red-500/10 border-t border-neutral-800/30"
                        >
                          <Trash2 className="h-4 w-4" /> Excluir usuário
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function initials(v: string) {
  return v.split(/[\s@.]+/).filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}
function RoleBadge({ role }: { role: Role }) {
  if (role === "admin") {
    return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30">Admin</span>;
  }
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">Usuário</span>;
}

type CreatePayload = { email: string; password: string; name?: string; role: Role };

function CreateUserModal({
  isDark,
  onClose,
  onCreate,
}: {
  isDark: boolean;
  onClose: () => void;
  onCreate: (p: CreatePayload) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const panel = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const input =
    "h-10 w-full rounded-md border px-3 text-sm outline-none " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 focus:border-emerald-700");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const error = await onCreate({ email: email.trim(), password, name: name.trim() || undefined, role });
    setBusy(false);
    if (error) { setErr(error); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-xl border shadow-xl p-6 space-y-4 ${panel}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Novo usuário</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-neutral-500/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">E-mail *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Senha *</label>
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="mínimo 6 caracteres" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Função</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={input}>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>

        {err && <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-500 text-sm p-2">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-md border border-neutral-500/30 text-sm hover:bg-neutral-500/10">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="h-10 px-4 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 inline-flex items-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar usuário
          </button>
        </div>
      </form>
    </div>
  );
}
