import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  Palette,
  Bell,
  Shield,
  CreditCard,
  Save,
  Upload,
  Check,
} from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";

export const Route = createFileRoute("/dashboard/configuracoes")({
  component: ConfiguracoesPage,
});

type SectionKey = "geral" | "aparencia" | "notificacoes" | "seguranca" | "faturamento";

const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "geral", label: "Geral", icon: Building2 },
  { key: "aparencia", label: "Aparência", icon: Palette },
  { key: "notificacoes", label: "Notificações", icon: Bell },
  { key: "seguranca", label: "Segurança", icon: Shield },
  { key: "faturamento", label: "Faturamento", icon: CreditCard },
];

type Settings = {
  appName: string;
  supportEmail: string;
  timezone: string;
  language: string;
  currency: string;
  accent: string;
  density: "confortavel" | "compacto";
  notifNewUser: boolean;
  notifNewTicket: boolean;
  notifDailyReport: boolean;
  notifEmail: boolean;
  twoFA: boolean;
  sessionTimeout: number;
};

const DEFAULTS: Settings = {
  appName: "Smart Green",
  supportEmail: "suporte@smartgreen.com",
  timezone: "America/Sao_Paulo",
  language: "pt-BR",
  currency: "BRL",
  accent: "#54ee2b",
  density: "confortavel",
  notifNewUser: true,
  notifNewTicket: true,
  notifDailyReport: false,
  notifEmail: true,
  twoFA: false,
  sessionTimeout: 60,
};

const STORAGE_KEY = "sg-settings";

function ConfiguracoesPage() {
  const isDark = useIsDark();
  const [section, setSection] = useState<SectionKey>("geral");
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
  const subtle = isDark ? "text-neutral-500" : "text-neutral-500";
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      {/* Menu lateral de seções */}
      <nav className={`rounded-xl border p-2 h-fit ${panel}`}>
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors " +
                (active
                  ? isDark
                    ? "bg-neutral-800 text-white"
                    : "bg-neutral-100 text-neutral-900"
                  : isDark
                    ? "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900")
              }
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* Conteúdo */}
      <div className="space-y-4">
        {section === "geral" && (
          <Card panel={panel} title="Informações do App" subtitle="Nome, contato e localização." muted={muted}>
            <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] items-start gap-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="h-20 w-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #0f5f2a 0%, #54ee2b 100%)",
                  }}
                >
                  {settings.appName.slice(0, 2).toUpperCase()}
                </div>
                <button
                  className={
                    "text-xs inline-flex items-center gap-1 " +
                    (isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black")
                  }
                >
                  <Upload className="h-3 w-3" /> Trocar
                </button>
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
          </Card>
        )}

        {section === "aparencia" && (
          <Card panel={panel} title="Aparência" subtitle="Cores e densidade da interface." muted={muted}>
            <div className="space-y-4">
              <Field label="Cor de destaque" muted={muted}>
                <div className="flex items-center gap-3">
                  {["#54ee2b", "#1f8a3a", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"].map((c) => (
                    <button
                      key={c}
                      onClick={() => update("accent", c)}
                      className={
                        "h-8 w-8 rounded-full border-2 transition " +
                        (settings.accent === c ? "border-white scale-110" : "border-transparent")
                      }
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={settings.accent}
                    onChange={(e) => update("accent", e.target.value)}
                    className="h-8 w-10 rounded border-0 bg-transparent cursor-pointer"
                  />
                </div>
              </Field>

              <Field label="Densidade" muted={muted}>
                <div className="flex gap-2">
                  {(["confortavel", "compacto"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => update("density", d)}
                      className={
                        "px-4 py-2 rounded-md border text-sm font-medium capitalize transition " +
                        (settings.density === d
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                          : isDark
                            ? "border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                            : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")
                      }
                    >
                      {d === "confortavel" ? "Confortável" : "Compacto"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Card>
        )}

        {section === "notificacoes" && (
          <Card panel={panel} title="Notificações do Admin" subtitle="Escolha o que quer receber." muted={muted}>
            <div className="space-y-1">
              <Toggle
                label="Novo usuário cadastrado"
                desc="Receber um aviso a cada novo cadastro no app."
                value={settings.notifNewUser}
                onChange={(v) => update("notifNewUser", v)}
                isDark={isDark}
              />
              <Toggle
                label="Novo ticket publicado"
                desc="Alerta quando uma nova tip for publicada."
                value={settings.notifNewTicket}
                onChange={(v) => update("notifNewTicket", v)}
                isDark={isDark}
              />
              <Toggle
                label="Relatório diário"
                desc="Resumo diário de performance por e-mail."
                value={settings.notifDailyReport}
                onChange={(v) => update("notifDailyReport", v)}
                isDark={isDark}
              />
              <Toggle
                label="Enviar cópia por e-mail"
                desc="Receber uma cópia por e-mail de tudo que chega no painel."
                value={settings.notifEmail}
                onChange={(v) => update("notifEmail", v)}
                isDark={isDark}
              />
            </div>
          </Card>
        )}

        {section === "seguranca" && (
          <Card panel={panel} title="Segurança" subtitle="Proteção da sua conta admin." muted={muted}>
            <div className="space-y-4">
              <Toggle
                label="Autenticação em 2 fatores (2FA)"
                desc="Exigir código extra ao fazer login."
                value={settings.twoFA}
                onChange={(v) => update("twoFA", v)}
                isDark={isDark}
              />
              <Field label="Tempo de sessão (minutos)" muted={muted}>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={settings.sessionTimeout}
                  onChange={(e) => update("sessionTimeout", Number(e.target.value) || 60)}
                  className={fieldCls}
                />
              </Field>
              <div>
                <button
                  className={
                    "h-10 px-4 rounded-md border text-sm font-medium " +
                    (isDark
                      ? "border-neutral-800 bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
                  }
                >
                  Alterar senha
                </button>
              </div>
            </div>
          </Card>
        )}

        {section === "faturamento" && (
          <Card panel={panel} title="Faturamento" subtitle="Plano e método de pagamento." muted={muted}>
            <div
              className="rounded-xl p-5 text-white"
              style={{
                backgroundImage: "linear-gradient(135deg, #0a3d1c 0%, #1f8a3a 60%, #54ee2b 100%)",
              }}
            >
              <div className="text-xs uppercase tracking-wider opacity-80">Plano atual</div>
              <div className="text-2xl font-bold mt-1">Smart Green Pro</div>
              <div className="text-sm opacity-90 mt-1">R$ 197,00 / mês · próxima cobrança em 03/08/2026</div>
              <button className="mt-4 h-9 px-4 rounded-md bg-white/15 hover:bg-white/25 text-sm font-semibold backdrop-blur">
                Gerenciar plano
              </button>
            </div>
            <div className={`text-xs mt-3 ${subtle}`}>
              Pagamentos processados de forma segura. Cancele a qualquer momento.
            </div>
          </Card>
        )}

        {/* Barra de ação */}
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
    </div>
  );
}

function Card({
  panel,
  title,
  subtitle,
  muted,
  children,
}: {
  panel: string;
  title: string;
  subtitle: string;
  muted: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-5 ${panel}`}>
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        <p className={`text-xs ${muted} mt-0.5`}>{subtitle}</p>
      </div>
      {children}
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

function Toggle({
  label,
  desc,
  value,
  onChange,
  isDark,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isDark: boolean;
}) {
  return (
    <div
      className={
        "flex items-center justify-between py-3 border-b last:border-b-0 " +
        (isDark ? "border-neutral-800" : "border-neutral-200")
      }
    >
      <div className="pr-4">
        <div className="text-sm font-medium">{label}</div>
        <div className={"text-xs " + (isDark ? "text-neutral-400" : "text-neutral-500")}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={
          "relative h-6 w-11 rounded-full transition-colors shrink-0 " +
          (value ? "bg-emerald-500" : isDark ? "bg-neutral-700" : "bg-neutral-300")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform " +
            (value ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
