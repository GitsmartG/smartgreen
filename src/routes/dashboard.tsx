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
          {/* Hero card com degradê */}
          <div
            className="relative overflow-hidden rounded-xl p-6 sm:p-8 text-white shadow-lg"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #0a3d1c 0%, #0f5f2a 45%, #1f8a3a 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-20 blur-2xl"
              style={{ background: "#54ee2b" }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium">
                <Leaf className="h-3.5 w-3.5" /> Smart Green · Painel
              </div>
              <h2 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight">
                Tudo pronto pra decolar 🚀
              </h2>
              <p className="mt-2 text-sm sm:text-base text-white/80 max-w-xl">
                Suas métricas estão sincronizadas. Acompanhe receita, usuários
                e conversão em tempo real.
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className={`relative overflow-hidden rounded-xl border p-5 ${panel} transition-transform hover:-translate-y-0.5`}
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
                  }}
                />
                <div className="flex items-start justify-between">
                  <span className={`text-xs uppercase tracking-wide ${muted}`}>
                    {s.label}
                  </span>
                  <div
                    className={
                      "h-10 w-10 rounded-lg flex items-center justify-center " +
                      (isDark ? "bg-emerald-500/10" : "bg-emerald-50")
                    }
                  >
                    <s.icon className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-semibold">{s.value}</div>
                <div className="mt-1 text-xs text-emerald-500 font-medium">
                  {s.delta} no mês
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico + atividade */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={`lg:col-span-2 rounded-xl border p-6 ${panel}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold">Receita nos últimos 7 dias</h3>
                  <p className={`text-xs ${muted} mt-0.5`}>Atualizado agora</p>
                </div>
                <BarChart3 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex items-end gap-2 h-40">
                {[45, 62, 38, 78, 55, 90, 72].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${h}%`,
                        backgroundImage:
                          "linear-gradient(180deg, #54ee2b 0%, #1f8a3a 100%)",
                      }}
                    />
                    <span className={`text-[10px] ${muted}`}>
                      {["S", "T", "Q", "Q", "S", "S", "D"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-xl border p-6 ${panel}`}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-semibold">Atividade recente</h3>
              </div>
              <ul className="space-y-4">
                {[
                  { t: "Novo usuário cadastrado", s: "há 2 min" },
                  { t: "Pagamento confirmado", s: "há 18 min" },
                  { t: "Relatório gerado", s: "há 1 h" },
                  { t: "Meta mensal atingida 🎯", s: "há 3 h" },
                ].map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.t}</p>
                      <p className={`text-xs ${muted}`}>{a.s}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
