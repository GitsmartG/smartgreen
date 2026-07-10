import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Building2, Save, Check, Activity, RefreshCw, AlertCircle, Gauge, Cable, Copy, ExternalLink, ToggleLeft } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { getStatpalUsage, type StatpalUsage } from "@/lib/statpal-usage.functions";
import { supabase } from "@/integrations/supabase/client";
import { getFeatureFlags, setFeatureFlag, FEATURE_KEYS, type FeatureKey, type FeatureFlags } from "@/lib/feature-flags.functions";
import { getInternalApiKey, regenerateApiKey } from "@/lib/internal-api-key.functions";



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
  method: "GET" | "POST";
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
  // Base URL fixa do site do Vercel — é dele que o app mobile / front consomem a API.
  const origin = "https://smartgreen-phi.vercel.app";
  const [copied, setCopied] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loadingKey, setLoadingKey] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const getInternalApiKeyFn = useServerFn(getInternalApiKey);
  const regenerateApiKeyFn = useServerFn(regenerateApiKey);

  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0) => {
      try {
        setLoadingKey(true);
        setKeyError(null);
        const res = await getInternalApiKeyFn();
        if (cancelled) return;
        if (res?.key) {
          setApiKey(res.key);
          return;
        }
        // Sem chave ainda: gera automaticamente na primeira visita.
        const created = await regenerateApiKeyFn();
        if (!cancelled && created?.key) {
          setApiKey(created.key);
          setApiKeyRevealed(true);
        }
      } catch (err) {
        // Sessão pode não ter hidratado ainda — tenta de novo.
        if (!cancelled && attempt < 4) {
          setTimeout(() => void load(attempt + 1), 600);
        } else if (!cancelled) {
          setKeyError(err instanceof Error ? err.message : "Erro ao carregar chave");
        }
      } finally {
        if (!cancelled) setLoadingKey(false);
      }
    };

    // Espera a sessão do supabase estar disponível antes da primeira chamada.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) {
        setSessionReady(true);
        void load();
      }
      if (!cancelled && !data.session) {
        setSessionReady(false);
        setLoadingKey(false);
        setKeyError(null);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSessionReady(Boolean(session));
      if (session && !cancelled) void load();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [getInternalApiKeyFn, regenerateApiKeyFn]);

  const handleRegenerate = async () => {
    if (regenerating) return;
    if (!sessionReady) {
      setKeyError("Sessão segura ainda não carregou. Entre de novo pela tela inicial.");
      return;
    }
    if (apiKey && !confirm("Gerar uma nova chave vai INVALIDAR a chave atual. Continuar?")) return;
    setRegenerating(true);
    try {
      setKeyError(null);
      const res = await regenerateApiKeyFn();
      if (res?.key) {
        setApiKey(res.key);
        setApiKeyRevealed(true);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "desconhecido";
      setKeyError(message);
      alert("Erro ao gerar chave: " + message);
    } finally {
      setRegenerating(false);
    }
  };




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
      method: "POST",
      path: "/api/public/mobile/signup",
      title: "Cadastro (signup)",
      desc: "Cria uma conta nova no app. Body JSON: { email, password, name? }. NÃO exige X-API-Key. Retorna access_token, refresh_token e user { id, email, role }.",
      notes: [
        "password: mínimo 6, máximo 128 caracteres.",
        "Se needs_email_confirmation=true, peça pro user confirmar o email antes de logar.",
        "Guarde os tokens em storage seguro (Keychain/EncryptedSharedPreferences/expo-secure-store).",
      ],
    },
    {
      method: "POST",
      path: "/api/public/mobile/login",
      title: "Login (email + senha)",
      desc: "Autentica um usuário existente. Body JSON: { email, password }. NÃO exige X-API-Key (a auth é pela senha). Retorna access_token, refresh_token, expires_in e user { id, email, role }.",
      notes: [
        "401 = email ou senha incorretos.",
        "role pode ser 'admin' ou 'user' — use pra liberar áreas restritas no app.",
        "access_token expira em ~1h; use refresh_token pra renovar sem pedir senha de novo.",
      ],
    },
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
      path: "/api/public/mobile/notifications/live",
      title: "Notificações ao vivo",
      desc: "Feed pronto de notificações de todos os jogos ao vivo: gols, cartões, eventos e estado do jogo. Não depende do painel web aberto.",
      notes: [
        "Recomendado polling a cada 10–15s no app mobile.",
        "Use notification.id pra deduplicar no app antes de mostrar push/local notification.",
        "Query opcional: ?include_match_state=false pra retornar só events[] reais, sem item de estado do jogo.",
      ],
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


  const notifShape = `// GET /api/public/mobile/notifications/live → 200
{
  "ok": true,
  "fetchedAt": "2026-07-08T21:47:00.000Z",
  "count": 2,
  "matchesCount": 8,
  "notifications": [
    {
      "id": "9981234:event:e4",
      "matchId": "9981234",
      "kind": "goal",                 // goal | card | event | live | finish
      "type": "goal",
      "title": "Gol do Flamengo",
      "text": "58' goal · Flamengo · Arrascaeta (2-1)",
      "league": "Brasileirão Série A",
      "leagueId": "384",
      "minute": "58",
      "team": "home",
      "player": "Arrascaeta",
      "result": "2-1",
      "score1": 2,
      "score2": 1,
      "status": "live",
      "rawStatus": "58'",
      "live": true,
      "finished": false,
      "team1": { "id": "1234", "name": "Flamengo", "logo": "https://.../api/public/team-image/1234" },
      "team2": { "id": "5678", "name": "Palmeiras", "logo": "https://.../api/public/team-image/5678" },
      "fetchedAt": "2026-07-08T21:47:00.000Z"
    }
  ]
}`;

  const matchShape = `// GET /api/public/mobile/matches/live → 200
{
  "ok": true,
  "fetchedAt": "2026-07-08T21:47:00.000Z",
  "count": 1,
  "matches": [
    {
      "id": "9981234",
      "league": "Brasileirão Série A",
      "leagueId": "384",
      "status": "live",            // scheduled | live | finished
      "minute": "62",
      "startMs": 1783545000000,
      "team1": { "id": "1234", "name": "Flamengo", "logo": "/api/public/team-image/1234" },
      "team2": { "id": "5678", "name": "Palmeiras", "logo": "/api/public/team-image/5678" },
      "score1": 2,
      "score2": 1,
      "events": [
        { "id": "e1", "type": "goal", "team": "home", "minute": "12", "player": "Pedro", "result": "1-0" },
        { "id": "e2", "type": "yellowcard", "team": "away", "minute": "34", "player": "Gómez" },
        { "id": "e3", "type": "goal", "team": "away", "minute": "51", "player": "Endrick", "result": "1-1" },
        { "id": "e4", "type": "goal", "team": "home", "minute": "58", "player": "Arrascaeta", "result": "2-1" }
      ]
    }
  ]
}`;

  const errorShape = `// Respostas de erro (todas retornam JSON)
401 Unauthorized  → { "ok": false, "error": "invalid_api_key" }
429 Too Many Reqs → { "ok": false, "error": "rate_limited" }
500 Server Error  → { "ok": false, "error": "mensagem detalhada" }`;

  const curlExample = `# cURL — jogos ao vivo
curl -H "X-API-Key: ${apiKey || "SUA_CHAVE_AQUI"}" \\
  ${origin}/api/public/mobile/matches/live

# cURL — só tickets green (últimos 20)
curl -H "X-API-Key: ${apiKey || "SUA_CHAVE_AQUI"}" \\
  "${origin}/api/public/mobile/tickets?status=green&limit=20"`;

  const jsExample = `// JavaScript / TypeScript (browser, Node, Vercel)
const API_BASE = "${origin}";
const API_KEY  = "${apiKey || "SUA_CHAVE_AQUI"}";

async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\`);
  return res.json();
}

// Uso
const { tickets }  = await apiGet("/api/public/mobile/tickets", { status: "ao_vivo", limit: 50 });
const { matches }  = await apiGet("/api/public/mobile/matches/live");
const { notifications } = await apiGet("/api/public/mobile/notifications/live", { limit: 200 });
const oneTicket    = await apiGet("/api/public/mobile/tickets/A7F3B21C4E88");`;

  const rnExample = `// React Native / Expo — hook com polling
import { useEffect, useState } from "react";

const API_BASE = "${origin}";
const API_KEY  = "${apiKey || "SUA_CHAVE_AQUI"}";

export function useLiveMatches(intervalMs = 15000) {
  const [matches, setMatches] = useState([]);
  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [liveRes, notifRes] = await Promise.all([
        fetch(\`\${API_BASE}/api/public/mobile/matches/live\`, {
          headers: { "X-API-Key": API_KEY },
        }),
        fetch(\`\${API_BASE}/api/public/mobile/notifications/live\`, {
          headers: { "X-API-Key": API_KEY },
        }),
      ]);
      const live = await liveRes.json();
      const notif = await notifRes.json();
      if (!alive) return;
      if (live.ok) setMatches(live.matches);
      if (notif.ok) setNotifications(notif.notifications);
    };
    load();
    const t = setInterval(load, intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [intervalMs]);
  return { matches, notifications };
}`;

  const paramsTable: Array<{ param: string; type: string; desc: string; example: string }> = [
    { param: "status", type: "string", desc: "Filtra por status do ticket.", example: "?status=green" },
    { param: "type", type: "string", desc: "Filtra por tipo de bilhete.", example: "?type=Simples ou ?type=Múltipla" },
    { param: "date", type: "string", desc: "Filtra por data do jogo (fuso BRT). Aceita alias ou YYYY-MM-DD.", example: "?date=today | yesterday | tomorrow | 2026-07-10" },
    { param: "since", type: "ISO date", desc: "Sync incremental: só devolve tickets com updated_at > since. Use pra atualizar cache do app sem baixar tudo.", example: "?since=2026-07-10T14:00:00Z" },
    { param: "limit",  type: "number", desc: "Máximo de tickets (default 100, teto 500).", example: "?limit=50" },
  ];

  const [tab, setTab] = useState<"curl" | "js" | "rn">("js");


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
              Endpoints REST que o app iOS/Android e o site do Vercel consomem. Protegidos por X-API-Key, CORS liberado pros domínios do projeto.
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

      <div className={`rounded-xl border p-5 ${panel}`}>
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
            <Cable className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Chave da API (X-API-Key)</h3>
            <p className={`text-xs ${muted} mt-0.5`}>
              Envie essa chave no header <code className="font-mono">X-API-Key</code> em toda requisição pros endpoints
              <code className="font-mono"> /mobile/tickets </code> e <code className="font-mono">/mobile/matches/*</code>.
              Sem ela, o servidor devolve <code className="font-mono">401</code>. Também aceita <code className="font-mono">Authorization: Bearer &lt;chave&gt;</code> ou <code className="font-mono">?api_key=...</code> na URL.
            </p>
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${box} flex items-center justify-between gap-2`}>
          <div className="min-w-0 flex-1">
            <div className={`text-[10px] uppercase tracking-wider ${muted}`}>SMARTGREEN_API_KEY</div>
            <div className={codeCls + " text-amber-500 truncate"}>
              {loadingKey
                ? "Carregando chave..."
                : apiKey
                ? apiKeyRevealed
                  ? apiKey
                  : apiKey.slice(0, 6) + "•".repeat(Math.max(apiKey.length - 10, 8)) + apiKey.slice(-4)
                : sessionReady
                  ? "Nenhuma chave gerada ainda"
                  : "Sessão segura pendente"}
            </div>
            {keyError && <div className="mt-1 text-[11px] text-red-500">{keyError}</div>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {apiKey && (
              <button
                onClick={() => setApiKeyRevealed((v) => !v)}
                className={
                  "h-8 px-3 rounded-md border text-xs font-medium " +
                  (isDark
                    ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                    : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
                }
              >
                {apiKeyRevealed ? "Ocultar" : "Ver"}
              </button>
            )}
            <button
              disabled={!apiKey || !sessionReady}
              onClick={() => apiKey && copy(apiKey)}
              className={
                "h-8 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40 " +
                (isDark
                  ? "border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
              }
            >
              <Copy className="h-3.5 w-3.5" />
              {copied === apiKey ? "Copiado" : "Copiar"}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating || loadingKey || !sessionReady}
              className={
                "h-8 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40 " +
                "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Gerando..." : apiKey ? "Nova chave" : "Gerar chave"}
            </button>
          </div>
        </div>

        <div className={`mt-3 rounded-lg border ${box}`}>
          <div className="flex items-center gap-1 border-b border-inherit p-1.5">
            {([
              { id: "js" as const, label: "JavaScript / TS" },
              { id: "rn" as const, label: "React Native" },
              { id: "curl" as const, label: "cURL" },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "h-7 px-3 rounded text-[11px] font-medium transition-colors " +
                  (tab === t.id
                    ? "bg-emerald-500/15 text-emerald-500"
                    : (isDark ? "text-neutral-400 hover:text-neutral-200" : "text-neutral-500 hover:text-neutral-800"))
                }
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => copy(tab === "curl" ? curlExample : tab === "rn" ? rnExample : jsExample)}
              className={
                "ml-auto h-7 px-2.5 rounded text-[11px] font-medium inline-flex items-center gap-1 " +
                (isDark ? "text-neutral-400 hover:text-neutral-200" : "text-neutral-500 hover:text-neutral-800")
              }
            >
              <Copy className="h-3 w-3" />
              Copiar
            </button>
          </div>
          <pre className={`${codeCls} overflow-x-auto whitespace-pre p-3 max-h-[360px]`}>
{tab === "curl" ? curlExample : tab === "rn" ? rnExample : jsExample}
          </pre>
        </div>
        <p className={`text-[11px] ${muted} mt-2`}>
          Origens liberadas via CORS: <code className="font-mono">smartgreen-phi.vercel.app</code>, qualquer <code className="font-mono">*.vercel.app</code> e <code className="font-mono">localhost</code>. Cache do servidor: 5s (tickets), 15s (matches/live), 60s (matches/today).
        </p>
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
          Use <code className="font-mono">/mobile/notifications/live</code> pra consumir um feed pronto e persistido de eventos ao vivo.
          O backend coleta sozinho todo minuto; o app ainda pode fazer polling a cada 10–15s pra exibir rápido.
        </p>
        <pre className={`rounded-lg border p-3 ${box} ${codeCls} overflow-x-auto whitespace-pre`}>{notifShape}</pre>
      </div>

      <div className={`rounded-xl border p-5 ${panel}`}>
        <h4 className="font-semibold mb-1">Exemplo de payload — Tickets / Dicas</h4>
        <p className={`text-xs ${muted} mb-3`}>
          Formato completo que <code className="font-mono">/mobile/tickets</code> devolve. Já tem tudo pra montar o card da dica:
          liga, evento, palpite, odd, valor, status, placar ao vivo, logos e o link do bilhete pro botão APOSTAR.
        </p>
        <pre className={`rounded-lg border p-3 ${box} ${codeCls} overflow-x-auto whitespace-pre max-h-[480px]`}>{ticketShape}</pre>
      </div>

      <div className={`rounded-xl border p-5 ${panel}`}>
        <h4 className="font-semibold mb-1">Query params — /mobile/tickets</h4>
        <p className={`text-xs ${muted} mb-3`}>Filtros opcionais aceitos na URL. Combine à vontade.</p>
        <div className={`rounded-lg border ${box} overflow-hidden`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? "bg-neutral-900/60" : "bg-neutral-100"}>
                <th className="text-left px-3 py-2 font-semibold">Param</th>
                <th className="text-left px-3 py-2 font-semibold">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold">Descrição</th>
                <th className="text-left px-3 py-2 font-semibold">Exemplo</th>
              </tr>
            </thead>
            <tbody>
              {paramsTable.map((p) => (
                <tr key={p.param} className="border-t border-inherit">
                  <td className="px-3 py-2 font-mono text-emerald-500">{p.param}</td>
                  <td className={`px-3 py-2 ${muted}`}>{p.type}</td>
                  <td className="px-3 py-2">{p.desc}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{p.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${panel}`}>
        <h4 className="font-semibold mb-1">Exemplo de payload — Matches (ao vivo)</h4>
        <p className={`text-xs ${muted} mb-3`}>
          Formato do <code className="font-mono">/mobile/matches/live</code>. Cada match traz <code className="font-mono">events[]</code>: use pra gerar push (compare com o snapshot anterior).
        </p>
        <pre className={`rounded-lg border p-3 ${box} ${codeCls} overflow-x-auto whitespace-pre max-h-[480px]`}>{matchShape}</pre>
      </div>

      <div className={`rounded-xl border p-5 ${panel}`}>
        <h4 className="font-semibold mb-1">Respostas de erro</h4>
        <p className={`text-xs ${muted} mb-3`}>Toda resposta de erro é JSON com <code className="font-mono">ok: false</code>.</p>
        <pre className={`rounded-lg border p-3 ${box} ${codeCls} overflow-x-auto whitespace-pre`}>{errorShape}</pre>
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
  const setFeatureFlagFn = useServerFn(setFeatureFlag);

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
      await setFeatureFlagFn({ data: { key, enabled: next } });
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
