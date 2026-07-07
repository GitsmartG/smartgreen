import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Ticket,
  Bell,
  Settings,
  LogOut,
  Sun,
  Moon,
  CalendarDays,
} from "lucide-react";
import { LiveNotificationsPanel } from "@/components/LiveNotificationsPanel";

const LOGO_URL =
  "https://wffylwohekfpecslflgc.supabase.co/storage/v1/object/public/files/uploads/t7QtTgpHfAeBSDZvo5b7DViqtR73/1783110032648-mkbpm-logo_smartgreen.png";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
  head: () => ({
    meta: [
      { title: "Dashboard · Smart Green" },
      { name: "description", content: "Painel Smart Green" },
    ],
  }),
});

function DashboardLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("sg-theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sg-theme", theme);
  }, [theme]);

  const isDark = theme === "dark";

  const handleLogout = () => {
    localStorage.removeItem("sg-auth");
    navigate({ to: "/" });
  };

  const bg = isDark ? "bg-neutral-950" : "bg-neutral-100";
  const panel = isDark
    ? "bg-neutral-900 border-neutral-800"
    : "bg-white border-neutral-200";
  const text = isDark ? "text-neutral-100" : "text-neutral-900";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";

  const nav = [
    { label: "Visão geral", icon: LayoutDashboard, to: "/dashboard" },
    { label: "Usuários", icon: Users, to: "/dashboard/usuarios" },
    { label: "Dicas de Apostas", icon: Ticket, to: "/dashboard/dicas" },
    { label: "Jogos de Hoje", icon: CalendarDays, to: "/dashboard/jogos" },
    { label: "Notificações Push", icon: Bell, to: "/dashboard/notificacoes" },
    { label: "Configurações", icon: Settings, to: "/dashboard/configuracoes" },
  ];

  const headerTitle =
    pathname === "/dashboard/usuarios"
      ? "Gerenciar Usuários"
      : pathname === "/dashboard/dicas"
        ? "Dicas de Apostas"
        : pathname === "/dashboard/jogos"
          ? "Jogos de Hoje"
          : pathname === "/dashboard/notificacoes"
            ? "Notificações Push"
            : pathname === "/dashboard/configuracoes"
              ? "Configurações"
              : "Visão geral";
  const headerSub =
    pathname === "/dashboard/usuarios"
      ? "Visualize e gerencie os usuários do seu app."
      : pathname === "/dashboard/dicas"
        ? "Gerencie e publique tickets de tips esportivas."
        : pathname === "/dashboard/jogos"
          ? "Partidas do dia atualizadas automaticamente."
          : pathname === "/dashboard/notificacoes"
            ? "Envie e agende notificações push."
            : pathname === "/dashboard/configuracoes"
              ? "Personalize seu painel e sua conta."
              : "Bem-vindo de volta 👋";


  return (
    <div className={`h-screen overflow-hidden font-sans flex ${bg} ${text} transition-colors`}>
      <aside className={`hidden md:flex w-64 h-screen shrink-0 flex-col border-r ${panel} transition-colors`}>
        <div className="h-16 shrink-0 flex items-center gap-2 px-5 border-b border-inherit">
          <img src={LOGO_URL} alt="Smart Green" className="h-8 w-auto object-contain" />
          <span className="font-semibold tracking-tight">Smart Green</span>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={
                  "w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors " +
                  (active
                    ? isDark
                      ? "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-neutral-900"
                    : isDark
                      ? "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")
                }
              >
                <item.icon className="h-6 w-6 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0">
          <LiveNotificationsPanel isDark={isDark} />
        </div>
        <div className="p-3 border-t border-inherit shrink-0">
          <button
            onClick={handleLogout}
            className={
              "w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors " +
              (isDark
                ? "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")
            }
          >
            <LogOut className="h-6 w-6 shrink-0" strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className={`h-16 shrink-0 flex items-center justify-between px-6 border-b ${panel} transition-colors`}>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{headerTitle}</h1>
            <p className={`text-xs ${muted}`}>{headerSub}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Alternar tema"
              className={
                "h-9 w-9 rounded-md border flex items-center justify-center transition-colors " +
                (isDark
                  ? "border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50")
              }
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleLogout}
              className={
                "md:hidden h-9 px-3 rounded-md border text-sm flex items-center gap-2 " +
                (isDark
                  ? "border-neutral-800 text-neutral-300"
                  : "border-neutral-300 text-neutral-700")
              }
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
