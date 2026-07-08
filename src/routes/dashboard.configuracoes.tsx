import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Save, Check, Activity, RefreshCw, AlertCircle, Gauge, Cable, Copy, ExternalLink } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getStatpalUsage, type StatpalUsage } from "@/lib/statpal-usage.functions";

export const Route = createFileRoute("/dashboard/configuracoes")({
  component: ConfiguracoesPage,
});

type Settings = {
  appName: string;
  supportEmail: string;
  timezone: string;
  language: string;
  currency: string;
};

const DEFAULTS: Settings = {
  appName: "Smart Green",
  supportEmail: "",
  timezone: "America/Sao_Paulo",
  language: "pt-BR",
  currency: "BRL",
};

const STORAGE_KEY = "sg-settings";

type TabKey = "geral" | "monitoramento" | "api";

function ConfiguracoesPage() {
  const isDark = useIsDark();
  const [tab, setTab] = useState<TabKey>("geral");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {
        /* noop */
      }
    }
  }, []);

  const panel = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const fieldCls =
    "h-10 w-full rounded-md border px-3 text-sm outline-none transition-colors " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 focus:border-emerald-700");

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const salvar = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const navBtn = (active: boolean) =>
    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors " +
    (active
      ? isDark
        ? "bg-neutral-800 text-white"
        : "bg-neutral-100 text-neutral-900"
      : isDark
        ? "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      <nav className={`rounded-xl border p-2 h-fit ${panel} flex flex-col gap-1`}>
        <button className={navBtn(tab === "geral")} onClick={() => setTab("geral")}>
          <Building2 className="h-4 w-4" />
          Geral
        </button>
        <button className={navBtn(tab === "monitoramento")} onClick={() => setTab("monitoramento")}>
          <Activity className="h-4 w-4" />
          Monitoramento
        </button>
      </nav>

      {tab === "geral" && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-5 ${panel}`}>
            <div className="mb-4">
              <h3 className="font-semibold">Informações do App</h3>
              <p className={`text-xs ${muted} mt-0.5`}>Nome, contato e localização.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome do App" muted={muted}>
                <input
                  value={settings.appName}
                  onChange={(e) => update("appName", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <Field label="E-mail de suporte" muted={muted}>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => update("supportEmail", e.target.value)}
                  placeholder="suporte@seudominio.com"
                  className={fieldCls}
                />
              </Field>
              <Field label="Fuso horário" muted={muted}>
                <select
                  value={settings.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                  className={fieldCls}
                >
                  <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                  <option value="America/Manaus">America/Manaus</option>
                  <option value="America/Fortaleza">America/Fortaleza</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/Lisbon">Europe/Lisbon</option>
                </select>
              </Field>
              <Field label="Idioma" muted={muted}>
                <select
                  value={settings.language}
                  onChange={(e) => update("language", e.target.value)}
                  className={fieldCls}
                >
                  <option value="pt-BR">Português (BR)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </Field>
              <Field label="Moeda" muted={muted}>
                <select
                  value={settings.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className={fieldCls}
                >
                  <option value="BRL">BRL — Real</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </Field>
            </div>
          </div>

          <div className={`rounded-xl border p-3 flex items-center justify-between ${panel}`}>
            <div className={`text-xs ${muted}`}>
              {saved ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-500 font-medium">
                  <Check className="h-4 w-4" /> Configurações salvas
                </span>
              ) : (
                "Alterações não são aplicadas até você salvar."
              )}
            </div>
            <button
              onClick={salvar}
              style={{
                backgroundImage: "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
              }}
              className="h-10 px-5 rounded-md text-white text-sm font-semibold inline-flex items-center gap-2 hover:brightness-110 active:brightness-95 shadow-sm"
            >
              <Save className="h-4 w-4" /> Salvar alterações
            </button>
          </div>
        </div>
      )}

      {tab === "monitoramento" && <MonitoramentoPanel isDark={isDark} panel={panel} muted={muted} />}
    </div>
  );
}

function MonitoramentoPanel({
  isDark,
  panel,
  muted,
}: {
  isDark: boolean;
  panel: string;
  muted: string;
}) {
  const [state, setState] = useState<{ loading: boolean; data: StatpalUsage | null; at: number | null }>({
    loading: true,
    data: null,
    at: null,
  });

  const load = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await getStatpalUsage();
      setState({ loading: false, data: res, at: Date.now() });
    } catch (e) {
      setState({
        loading: false,
        data: { ok: false, error: e instanceof Error ? e.message : "Erro" },
        at: Date.now(),
      });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const count = state.data?.requestCount ?? 0;
  const dailyLimit = 50000; // plano Statpal: 50k requisições/dia
  const pct = Math.min(100, Math.round((count / dailyLimit) * 100));
  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Uso da API Statpal</h3>
              <p className={`text-xs ${muted} mt-0.5`}>
                Quantas requisições foram feitas hoje ao provedor de dados esportivos.
              </p>
            </div>
          </div>
          <button
            onClick={() => void load()}
            disabled={state.loading}
            className={
              "h-9 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-60 " +
              (isDark
                ? "border-neutral-800 bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <RefreshCw className={`h-3.5 w-3.5 ${state.loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {state.data && !state.data.ok && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-sm px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{state.data.error ?? "Erro ao consultar a API."}</span>
          </div>
        )}

        {state.data?.ok && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatBlock label="Requisições hoje" value={String(count)} isDark={isDark} muted={muted} />
              <StatBlock
                label="Restante estimado"
                value={String(Math.max(0, dailyLimit - count))}
                isDark={isDark}
                muted={muted}
              />
              <StatBlock
                label="Data (Statpal)"
                value={state.data.currentDate ?? "—"}
                isDark={isDark}
                muted={muted}
              />
            </div>

            <div className="mt-4">
              <div className={`text-[11px] flex justify-between ${muted} mb-1.5`}>
                <span>Uso do dia</span>
                <span>{pct}% de {dailyLimit}</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-neutral-800" : "bg-neutral-200"}`}>
                <div
                  className={`h-full ${barColor} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className={`text-[11px] ${muted} mt-2`}>
                Limite diário estimado com base no plano padrão. Ajuste conforme seu contrato Statpal.
              </p>
            </div>
          </>
        )}

        {state.at && (
          <div className={`text-[11px] ${muted} mt-4`}>
            Última atualização: {new Date(state.at).toLocaleTimeString("pt-BR")}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  isDark,
  muted,
}: {
  label: string;
  value: string;
  isDark: boolean;
  muted: string;
}) {
  return (
    <div
      className={
        "rounded-lg border p-3 " +
        (isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200")
      }
    >
      <div className={`text-[10px] uppercase tracking-wider ${muted}`}>{label}</div>
      <div className="text-2xl font-bold text-emerald-500 mt-1 leading-none tabular-nums">{value}</div>
    </div>
  );
}

function Field({
  label,
  muted,
  children,
}: {
  label: string;
  muted: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={`text-xs ${muted}`}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
