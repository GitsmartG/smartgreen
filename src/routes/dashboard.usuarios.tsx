import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, RefreshCw, UserPlus, MoreHorizontal } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";

type Status = "ativo" | "suspenso";
type Role = "admin" | "user";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  createdAt: string;
  lastAccess: string | null;
};

const USERS: UserRow[] = [
  {
    id: "1",
    name: "Admin",
    email: "admin@smartgreen.com",
    role: "admin",
    status: "ativo",
    createdAt: "03 de jul. de 2026",
    lastAccess: "Agora",
  },
];

export const Route = createFileRoute("/dashboard/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const isDark = useIsDark();

  const panel = isDark
    ? "bg-neutral-900 border-neutral-800"
    : "bg-white border-neutral-200";
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

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | Status>("todos");
  const [roleFilter, setRoleFilter] = useState<"todas" | Role>("todas");

  const filtered = useMemo(() => {
    return USERS.filter((u) => {
      if (statusFilter !== "todos" && u.status !== statusFilter) return false;
      if (roleFilter !== "todas" && u.role !== roleFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !u.id.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [query, statusFilter, roleFilter]);

  return (
    <div className="space-y-4">
      {/* Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Usuários</h2>
          <p className={`text-xs ${muted} mt-0.5`}>
            {USERS.length} usuário{USERS.length !== 1 && "s"} cadastrado
            {USERS.length !== 1 && "s"} no total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={
              "h-10 px-4 rounded-md border text-sm font-medium inline-flex items-center gap-2 transition-colors " +
              (isDark
                ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button
            style={{
              backgroundImage:
                "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
            }}
            className="h-10 px-4 rounded-md text-white text-sm font-semibold inline-flex items-center gap-2 hover:brightness-110 active:brightness-95 shadow-sm"
          >
            <UserPlus className="h-4 w-4" /> Novo Usuário
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className={`rounded-xl border p-4 ${panel}`}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
          <div className="relative">
            <Search
              className={
                "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 " +
                (isDark ? "text-neutral-500" : "text-neutral-400")
              }
            />
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
            <option value="todas">Todas as Funções</option>
            <option value="admin">Administradores</option>
            <option value="user">Usuários</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className={selectCls}
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="suspenso">Suspensos</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className={`rounded-xl border overflow-hidden ${panel}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead
              className={
                "text-xs uppercase tracking-wide " +
                (isDark
                  ? "bg-neutral-950/50 text-neutral-500"
                  : "bg-neutral-50 text-neutral-500")
              }
            >
              <tr>
                <th className="text-left font-medium px-4 py-3 w-10">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="text-left font-medium px-4 py-3">Usuário</th>
                <th className="text-left font-medium px-4 py-3">Função</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Cadastro</th>
                <th className="text-left font-medium px-4 py-3">Último acesso</th>
                <th className="text-right font-medium px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className={`text-center py-12 ${muted}`}
                  >
                    Nenhum usuário encontrado com esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className={
                    "border-t transition-colors " +
                    (isDark
                      ? "border-neutral-800 hover:bg-neutral-800/40"
                      : "border-neutral-200 hover:bg-neutral-50")
                  }
                >
                  <td className="px-4 py-4">
                    <input type="checkbox" className="rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-xs font-semibold">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        <div className={`text-xs truncate ${muted}`}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className={`px-4 py-4 ${muted}`}>{u.createdAt}</td>
                  <td className={`px-4 py-4 ${muted}`}>
                    {u.lastAccess ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      className={
                        "h-8 w-8 rounded-md inline-flex items-center justify-center " +
                        (isDark
                          ? "hover:bg-neutral-800 text-neutral-400"
                          : "hover:bg-neutral-100 text-neutral-500")
                      }
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
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

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-500 border border-amber-500/30">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
      Usuário
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "ativo") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ativo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
      <span className="h-2 w-2 rounded-full bg-red-500" /> Suspenso
    </span>
  );
}
