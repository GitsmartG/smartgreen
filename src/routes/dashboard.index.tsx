import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  Ticket as TicketIcon,
  TrendingUp,
  TrendingDown,
  Radio,
  Leaf,
  Activity,
} from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { loadTickets, subscribeTickets, type Ticket } from "@/lib/tickets-store";

export const Route = createFileRoute("/dashboard/")({
  component: OverviewPage,
});

function OverviewPage() {
  const isDark = useIsDark();
  const panel = isDark
    ? "bg-neutral-900 border-neutral-800"
    : "bg-white border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  useEffect(() => {
    setTickets(loadTickets());
    return subscribeTickets(() => setTickets(loadTickets()));
  }, []);

  const total = tickets.length;
  const aoVivo = tickets.filter((t) => t.status === "ao_vivo").length;
  const greens = tickets.filter((t) => t.status === "green").length;
  const reds = tickets.filter((t) => t.status === "red").length;
  const finalizados = greens + reds;
  const winRate = finalizados > 0 ? Math.round((greens / finalizados) * 100) : 0;

  const stats = [
    { label: "Usuários", value: "1", icon: Users, hint: "1 admin cadastrado" },
    { label: "Tickets", value: String(total), icon: TicketIcon, hint: total === 0 ? "Nenhum ticket ainda" : `${total} no total` },
    { label: "Ao vivo", value: String(aoVivo), icon: Radio, hint: aoVivo === 1 ? "1 aberto" : `${aoVivo} abertos` },
    { label: "Win rate", value: `${winRate}%`, icon: TrendingUp, hint: `${greens} green · ${reds} red` },
  ];

  const recentes = tickets.slice(0, 5);

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
            Bem-vindo de volta 👋
          </h2>
          <p className="mt-2 text-sm sm:text-base text-white/80 max-w-xl">
            {total === 0
              ? "Você ainda não cadastrou nenhum ticket. Vá em Dicas de Apostas para criar o primeiro."
              : `Você tem ${total} ticket${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}, ${aoVivo} ao vivo agora.`}
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
            <div className={`mt-1 text-xs ${muted}`}>{s.hint}</div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border p-6 ${panel}`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-emerald-500" />
          <h3 className="text-base font-semibold">Tickets recentes</h3>
        </div>
        {recentes.length === 0 ? (
          <div className={`py-8 text-center text-sm ${muted}`}>
            Nenhum ticket cadastrado ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {recentes.map((t) => (
              <li
                key={t.id}
                className={
                  "flex items-center justify-between gap-3 py-2 border-b last:border-b-0 " +
                  (isDark ? "border-neutral-800" : "border-neutral-200")
                }
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.event}</div>
                  <div className={`text-xs truncate ${muted}`}>{t.palpite} · odd {t.odd.toFixed(2)}</div>
                </div>
                <StatusMini status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusMini({ status }: { status: Ticket["status"] }) {
  if (status === "ao_vivo")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 rounded-full px-2 py-0.5 bg-amber-500/10 border border-amber-500/30">
        <Radio className="h-3 w-3" /> Ao vivo
      </span>
    );
  if (status === "green")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 rounded-full px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30">
        <TrendingUp className="h-3 w-3" /> Green
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 rounded-full px-2 py-0.5 bg-red-500/10 border border-red-500/30">
      <TrendingDown className="h-3 w-3" /> Red
    </span>
  );
}
