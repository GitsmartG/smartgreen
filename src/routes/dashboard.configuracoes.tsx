import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Save, Check, Activity, RefreshCw, AlertCircle, Gauge, Cable, Copy, ExternalLink, ToggleLeft } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getStatpalUsage, type StatpalUsage } from "@/lib/statpal-usage.functions";
import { supabase } from "@/integrations/supabase/client";
import { getFeatureFlags, setFeatureFlag, FEATURE_KEYS, type FeatureKey, type FeatureFlags } from "@/lib/feature-flags.functions";



export const Route = createFileRoute("/dashboard/configuracoes")({
  component: ConfiguracoesPage,
});

type Settings = {
  appName: string;
  supportEmail: string;
  timezone: string;
  language: string;
  currency: string;
  feedoddsH2betKey: string;
  feedoddsH2betBrandId: string;
  feedoddsSeubetKey: string;
  feedoddsSeubetBrandId: string;
  proxyHost: string;
  proxyPort: string;
  proxyUser: string;
  proxyPass: string;
};

const DEFAULTS: Settings = {
  appName: "Smart Green",
  supportEmail: "",
  timezone: "America/Sao_Paulo",
  language: "pt-BR",
  currency: "BRL",
  feedoddsH2betKey: "",
  feedoddsH2betBrandId: "",
  feedoddsSeubetKey: "",
  feedoddsSeubetBrandId: "",
  proxyHost: "",
  proxyPort: "",
  proxyUser: "",
  proxyPass: "",
};


const STORAGE_KEY = "sg-settings";

type TabKey = "geral" | "funcionalidades" | "monitoramento" | "api";

function ConfiguracoesPage() {
  const isDark = useIsDark();
  const [tab, setTab] = useState<TabKey>("geral");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored: Partial<Settings> = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
    setSettings({ ...DEFAULTS, ...stored });

    // Puxa valores do backend (edge fn public-config) e faz merge só nos campos vazios,
    // pra não sobrescrever edições locais.
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("public-config");
        if (!data || typeof data !== "object") return;
        setSettings((s) => {
          const next = { ...s };
          for (const [k, v] of Object.entries(data as Record<string, string>)) {
            if (k in next && !next[k as keyof Settings] && typeof v === "string") {
              (next as Record<string, string>)[k] = v;
            }
          }
          return next;
        });
      } catch { /* noop */ }
    })();
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
        <button className={navBtn(tab === "funcionalidades")} onClick={() => setTab("funcionalidades")}>
          <ToggleLeft className="h-4 w-4" />
          Funcionalidades
        </button>
        <button className={navBtn(tab === "monitoramento")} onClick={() => setTab("monitoramento")}>
          <Activity className="h-4 w-4" />
          Monitoramento
        </button>

        <button className={navBtn(tab === "api")} onClick={() => setTab("api")}>
          <Cable className="h-4 w-4" />
          API Mobile
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

      {tab === "funcionalidades" && <FeaturesPanel isDark={isDark} panel={panel} muted={muted} />}
      {tab === "monitoramento" && <MonitoramentoPanel isDark={isDark} panel={panel} muted={muted} />}
      {tab === "api" && <ApiPanel isDark={isDark} panel={panel} muted={muted} />}

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

type EndpointDoc = {
  method: "GET";
  path: string;
  title: string;
  desc: string;
  notes?: string[];
};

function ApiPanel({
  isDark,
  panel,
  muted,
}: {
  isDark: boolean;
  panel: string;
  muted: string;
}) {
  const origin = useMemo(
    () => (typeof window === "undefined" ? "" : window.location.origin),
    [],
  );
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* noop */
    }
  };

  const endpoints: EndpointDoc[] = [
    {
      method: "GET",
      path: "/api/public/mobile/matches/live",
      title: "Jogos ao vivo",
      desc: "Lista de partidas AO VIVO no momento, com placar, minuto, status e array de eventos (gols, cartões, substituições).",
      notes: [
        "Recomendado polling a cada 15s no app mobile.",
        "Cada match traz events[] — compare com o snapshot anterior pra emitir push (gol, cartão, início, fim).",
      ],
    },
    {
      method: "GET",
      path: "/api/public/mobile/matches/today",
      title: "Jogos do dia",
      desc: "Toda a agenda do dia (agendados, ao vivo e encerrados), agrupada por liga.",
      notes: ["Cache de 60s no servidor. Ideal pra tela de agenda/lista."],
    },
    {
      method: "GET",
      path: "/api/public/team-image/{id}",
      title: "Logo do time",
      desc: "Proxy de imagem do escudo do time (usa o team.id retornado nos endpoints de matches). Retorna PNG/JPG ou SVG fallback.",
      notes: ["Cacheável por 24h. Use direto em <Image source={{ uri: ... }} />."],
    },
    {
      method: "GET",
      path: "/api/public/mobile/tickets",
      title: "Dicas / Tickets",
      desc: "Lista todos os tickets (tips) publicados no admin. Cada ticket já vem com status, odd, banca, times, placar, logo, link do bilhete e resultado por perna quando é múltipla.",
      notes: [
        "Filtro opcional: ?status=aguardando|ao_vivo|green|red",
        "Filtro opcional: ?limit=100 (máx 500)",
        "Ordenação: mais recentes primeiro (updated_at desc)",
        "Botão 'Apostar' no app: use ticket.url (abre no navegador ou WebView).",
      ],
    },
    {
      method: "GET",
      path: "/api/public/mobile/tickets/{id}",
      title: "Ticket individual",
      desc: "Detalhe completo de um ticket específico. Útil pra tela de detalhes com placar ao vivo por perna.",
    },
    {
      method: "GET",
      path: "/api/public/features",
      title: "Feature flags",
      desc: "Retorna quais áreas do app estão ativas (jogos, ligas, banca, parceiros, indique). Use pra esconder abas desabilitadas.",
    },
  ];

  const ticketShape = `// GET /api/public/mobile/tickets → 200
{
  "ok": true,
  "fetchedAt": "2026-07-08T14:33:00.000Z",
  "count": 2,
  "tickets": [
    {
      "id": "A7F3B21C4E88",
      "status": "ao_vivo",            // aguardando | ao_vivo | green | red
      "type": "Simples",              // Simples | Múltipla
      "league": "Brasileirão Série A",
      "event": "Flamengo x Palmeiras",
      "palpite": "Ambas marcam - Sim",
      "odd": 1.85,
      "banca": 100,                   // valor apostado (unidades ou R$)
      "esporte": "Futebol",
      "date": "2026-07-08T21:30:00Z",
      "entradas": 1,                  // >1 = múltipla
      "parceiro": "seubet",           // seubet | h2bet | null
      "url": "https://seubet.com/...", // link do bilhete → botão APOSTAR
      "startMs": 1783545000000,
      "score1": 1,
      "score2": 0,
      "team1Logo": "/api/public/team-image/1234",
      "team2Logo": "/api/public/team-image/5678",
      "createdAtMs": 1783538000000,
      "updatedAt": "2026-07-08T21:47:12.000Z",
      "legResults": null,             // preenchido em múltiplas
      "legStatuses": null,
      "resultCheckedAtMs": 1783545420000
    },
    {
      "id": "B9E1D67A2200",
      "status": "green",
      "type": "Múltipla",
      "league": "Múltipla — 3 jogos",
      "event": "Real x Barça + City x Arsenal + Bayern x Dortmund",
      "palpite": "Vitórias mandantes",
      "odd": 5.42,
      "banca": 50,
      "esporte": "Futebol",
      "date": "2026-07-07T20:00:00Z",
      "entradas": 3,
      "parceiro": "h2bet",
      "url": "https://h2.bet.br/...",
      "startMs": 1783458000000,
      "score1": null,
      "score2": null,
      "team1Logo": null,
      "team2Logo": null,
      "legStatuses": ["green", "green", "green"],
      "legResults": {
        "0": { "team1": "Real", "team2": "Barça", "score1": 2, "score2": 1, "status": "green", "finished": true },
        "1": { "team1": "City",  "team2": "Arsenal","score1": 3, "score2": 0, "status": "green", "finished": true },
        "2": { "team1": "Bayern","team2": "Dortmund","score1": 4, "score2": 2, "status": "green", "finished": true }
      }
    }
  ]
}`;


  const notifShape = `// Formato do evento (dentro de match.events[])
{
  "id": "string",           // id único do evento
  "type": "goal" | "yellowcard" | "redcard" | "subst" | ...,
  "team": "home" | "away",
  "minute": "45",
  "extraMin": "2",          // opcional
  "player": "string",       // opcional
  "assist": "string",       // opcional
  "result": "1-0"           // opcional (gols)
}`;

  const box = isDark ? "bg-neutral-950/60 border-neutral-800" : "bg-neutral-50 border-neutral-200";
  const codeCls = "font-mono text-[12px] break-all";

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <Cable className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">API pública pro app mobile</h3>
            <p className={`text-xs ${muted} mt-0.5`}>
              Endpoints REST que o app iOS/Android consome. Sem autenticação, CORS aberto, JSON puro.
            </p>
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${box} flex items-center justify-between gap-2`}>
          <div className="min-w-0">
            <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Base URL</div>
            <div className={codeCls + " text-emerald-500 truncate"}>{origin || "https://seu-dominio.com"}</div>
          </div>
          <button
            onClick={() => copy(origin)}
            className={
              "shrink-0 h-8 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 " +
              (isDark
                ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <Copy className="h-3.5 w-3.5" />
            {copied === origin ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      {endpoints.map((ep) => {
        const full = origin + ep.path.replace("{id}", "123");
        return (
          <div key={ep.path} className={`rounded-xl border p-5 ${panel}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                    {ep.method}
                  </span>
                  <h4 className="font-semibold">{ep.title}</h4>
                </div>
                <p className={`text-xs ${muted}`}>{ep.desc}</p>
              </div>
            </div>

            <div className={`rounded-lg border p-3 ${box} flex items-center justify-between gap-2 mt-3`}>
              <div className={codeCls + " text-emerald-500 truncate"}>{ep.path}</div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => copy(full)}
                  className={
                    "h-8 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 " +
                    (isDark
                      ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === full ? "Copiado" : "Copiar"}
                </button>
                {!ep.path.includes("{") && origin && (
                  <a
                    href={full}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      "h-8 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 " +
                      (isDark
                        ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Testar
                  </a>
                )}
              </div>
            </div>

            {ep.notes && ep.notes.length > 0 && (
              <ul className={`mt-3 text-xs ${muted} list-disc pl-5 space-y-1`}>
                {ep.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className={`rounded-xl border p-5 ${panel}`}>
        <h4 className="font-semibold mb-1">Notificações ao vivo (gols, cartões, início/fim)</h4>
        <p className={`text-xs ${muted} mb-3`}>
          Não existe endpoint separado de "notificações". O app faz polling em <code className="font-mono">/matches/live</code> a cada 15s
          e compara o placar e o array <code className="font-mono">events</code> com o snapshot anterior. Cada diff vira uma push local.
        </p>
        <pre className={`rounded-lg border p-3 ${box} ${codeCls} overflow-x-auto whitespace-pre`}>{notifShape}</pre>
      </div>
    </div>
  );
}


const FEATURE_LABELS: Record<FeatureKey, { label: string; desc: string }> = {
  jogos: { label: "Jogos", desc: "Aba de jogos ao vivo e agendados." },
  ligas: { label: "Ligas", desc: "Listagem e navegação por ligas." },
  banca: { label: "Banca", desc: "Gestão de banca e apostas." },
  parceiros: { label: "Parceiros", desc: "Área de casas parceiras." },
  indique: { label: "Indique", desc: "Programa de indicação." },
};

function FeaturesPanel({
  isDark,
  panel,
  muted,
}: {
  isDark: boolean;
  panel: string;
  muted: string;
}) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [saving, setSaving] = useState<FeatureKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getFeatureFlags();
        setFlags(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
      }
    })();
  }, []);

  const toggle = async (key: FeatureKey) => {
    if (!flags) return;
    const next = !flags[key];
    setFlags({ ...flags, [key]: next });
    setSaving(key);
    setError(null);
    try {
      await setFeatureFlag({ data: { key, enabled: next } });
    } catch (e) {
      setFlags({ ...flags, [key]: !next });
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(null);
    }
  };

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/public/features` : "/api/public/features";

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="mb-4">
          <h3 className="font-semibold">Ativar / desativar funcionalidades</h3>
          <p className={`text-xs ${muted} mt-0.5`}>
            Liga e desliga áreas do app. O estado fica público em{" "}
            <code className="text-emerald-500">/api/public/features</code>.
          </p>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-sm px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          {FEATURE_KEYS.map((key) => {
            const on = flags?.[key] ?? true;
            const busy = saving === key;
            return (
              <div
                key={key}
                className={
                  "flex items-center justify-between rounded-lg border px-4 py-3 " +
                  (isDark ? "border-neutral-800 bg-neutral-950" : "border-neutral-200 bg-neutral-50")
                }
              >
                <div>
                  <div className="text-sm font-medium">{FEATURE_LABELS[key].label}</div>
                  <div className={`text-xs ${muted} mt-0.5`}>{FEATURE_LABELS[key].desc}</div>
                </div>
                <button
                  onClick={() => void toggle(key)}
                  disabled={busy || !flags}
                  aria-pressed={on}
                  className={
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 " +
                    (on ? "bg-emerald-500" : isDark ? "bg-neutral-700" : "bg-neutral-300")
                  }
                >
                  <span
                    className={
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
                      (on ? "translate-x-5" : "translate-x-1")
                    }
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="mb-2 flex items-center gap-2">
          <Cable className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">Endpoint público</h3>
        </div>
        <p className={`text-xs ${muted} mb-3`}>
          GET retorna JSON com <code>true</code> / <code>false</code> por funcionalidade.
        </p>
        <div className="flex items-center gap-2">
          <code
            className={
              "flex-1 text-xs px-3 py-2 rounded-md border overflow-x-auto " +
              (isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-50 border-neutral-200")
            }
          >
            {endpoint}
          </code>
          <button
            onClick={() => void navigator.clipboard.writeText(endpoint)}
            className={
              "h-9 px-3 rounded-md border text-xs inline-flex items-center gap-1.5 " +
              (isDark
                ? "border-neutral-800 bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
          <a
            href={endpoint}
            target="_blank"
            rel="noreferrer"
            className={
              "h-9 px-3 rounded-md border text-xs inline-flex items-center gap-1.5 " +
              (isDark
                ? "border-neutral-800 bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
            }
          >
            <ExternalLink className="h-3.5 w-3.5" /> Testar
          </a>
        </div>
      </div>
    </div>
  );
}
