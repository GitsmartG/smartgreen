import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Save, Check } from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";

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

function ConfiguracoesPage() {
  const isDark = useIsDark();
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      <nav className={`rounded-xl border p-2 h-fit ${panel}`}>
        <button
          className={
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium " +
            (isDark ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-900")
          }
        >
          <Building2 className="h-4 w-4" />
          Geral
        </button>
      </nav>

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
