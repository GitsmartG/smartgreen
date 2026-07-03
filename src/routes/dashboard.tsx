import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  Leaf,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";

const LOGO_URL =
  "https://wffylwohekfpecslflgc.supabase.co/storage/v1/object/public/files/uploads/t7QtTgpHfAeBSDZvo5b7DViqtR73/1783110032648-mkbpm-logo_smartgreen.png";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard · Smart Green" },
      { name: "description", content: "Painel Smart Green" },
    ],
  }),
});

function DashboardPage() {
  const navigate = useNavigate();
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

  const stats = [
    { label: "Receita", value: "R$ 48.520", delta: "+12,4%", icon: DollarSign },
    { label: "Usuários", value: "1.284", delta: "+8,1%", icon: Users },
    { label: "Conversão", value: "3,7%", delta: "+0,6%", icon: TrendingUp },
    { label: "Atividade", value: "92%", delta: "+2,3%", icon: Activity },
  ];

  const nav = [
    { label: "Visão geral", icon: LayoutDashboard, active: true },
    { label: "Usuários", icon: Users, active: false },
    { label: "Relatórios", icon: BarChart3, active: false },
    { label: "Configurações", icon: Settings, active: false },
  ];

  return (
    <div className={`min-h-screen font-sans flex ${bg} ${text} transition-colors`}>
      <aside
        className={`hidden md:flex w-64 flex-col border-r ${panel} transition-colors`}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-inherit">
          <img src={LOGO_URL} alt="Smart Green" className="h-8 w-auto object-contain" />
          <span className="font-semibold tracking-tight">Smart Green</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => (
            <button
              key={item.label}
              className={
                "w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors " +
                (item.active
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
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-inherit">
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

      <main className="flex-1 flex flex-col">
        <header
          className={`h-16 flex items-center justify-between px-6 border-b ${panel} transition-colors`}
        >
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Visão geral</h1>
            <p className={`text-xs ${muted}`}>Bem-vindo de volta 👋</p>
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
            <Link
              to="/"
              onClick={handleLogout}
              className="md:hidden h-9 px-3 rounded-md border border-neutral-300 text-sm flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Sair
            </Link>
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`relative overflow-hidden rounded-lg border p-5 ${panel}`}
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-xs uppercase tracking-wide ${muted}`}>
                    {s.label}
                  </span>
                  <s.icon className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-3 text-2xl font-semibold">{s.value}</div>
                <div className="mt-1 text-xs text-emerald-500">{s.delta} no mês</div>
              </div>
            ))}
          </div>

          <div className={`rounded-lg border p-6 ${panel}`}>
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="h-4 w-4 text-emerald-500" />
              <h2 className="text-base font-semibold">Comece por aqui</h2>
            </div>
            <p className={`text-sm ${muted}`}>
              Seu painel Smart Green está pronto. Conecte seus dados e comece a
              acompanhar as métricas em tempo real.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
