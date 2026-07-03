import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  BarChart3,
  Leaf,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";

export const Route = createFileRoute("/dashboard/")({
  component: OverviewPage,
});

function OverviewPage() {
  const isDark = useIsDark();
  const panel = isDark
    ? "bg-neutral-900 border-neutral-800"
    : "bg-white border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";

  const stats = [
    { label: "Receita", value: "R$ 48.520", delta: "+12,4%", icon: DollarSign },
    { label: "Usuários", value: "1.284", delta: "+8,1%", icon: Users },
    { label: "Conversão", value: "3,7%", delta: "+0,6%", icon: TrendingUp },
    { label: "Atividade", value: "92%", delta: "+2,3%", icon: Activity },
  ];

  return (
    <div className="space-y-6">
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
            Suas métricas estão sincronizadas. Acompanhe receita, usuários e
            conversão em tempo real.
          </p>
        </div>
      </div>

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
  );
}
