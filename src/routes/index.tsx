import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Mail, Lock, Sun, Moon } from "lucide-react";

const LOGO_URL =
  "https://wffylwohekfpecslflgc.supabase.co/storage/v1/object/public/files/uploads/t7QtTgpHfAeBSDZvo5b7DViqtR73/1783110032648-mkbpm-logo_smartgreen.png";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Entrar · Smart Green" },
      { name: "description", content: "Acesse sua conta Smart Green" },
    ],
  }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("sg-theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sg-theme", theme);
  }, [theme]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  const isDark = theme === "dark";

  return (
    <div
      className={
        "min-h-screen font-sans flex items-center justify-center px-4 py-10 transition-colors " +
        (isDark ? "bg-neutral-950" : "bg-neutral-100")
      }
    >
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label="Alternar tema"
        className={
          "fixed top-4 right-4 h-10 w-10 rounded-md border flex items-center justify-center transition-colors " +
          (isDark
            ? "border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50")
        }
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-md">
        <div
          className={
            "relative overflow-hidden rounded-lg border p-8 sm:p-10 transition-colors " +
            (isDark
              ? "bg-neutral-900 border-neutral-800"
              : "bg-white border-neutral-200")
          }
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-0.5"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
            }}
          />
          <div className="flex flex-col items-center mb-8">
            <img
              src={LOGO_URL}
              alt="Smart Green"
              className="h-14 w-auto object-contain mb-5"
            />
            <h1
              className={
                "text-xl font-semibold tracking-tight " +
                (isDark ? "text-neutral-50" : "text-neutral-900")
              }
            >
              Acesse sua conta
            </h1>
            <p
              className={
                "text-sm mt-1 " + (isDark ? "text-neutral-400" : "text-neutral-500")
              }
            >
              Entre com suas credenciais Smart Green
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              id="email"
              label="E-mail"
              icon={<Mail className="h-4 w-4" />}
              isDark={isDark}
            >
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className={inputCls(isDark, false)}
              />
            </Field>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className={
                    "block text-sm font-medium " +
                    (isDark ? "text-neutral-300" : "text-neutral-700")
                  }
                >
                  Senha
                </label>
                <a
                  href="#"
                  className={
                    "text-xs font-medium " +
                    (isDark
                      ? "text-emerald-400 hover:text-emerald-300"
                      : "text-emerald-700 hover:text-emerald-800")
                  }
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <Lock
                  className={
                    "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none " +
                    (isDark ? "text-neutral-500" : "text-neutral-400")
                  }
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls(isDark, true)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className={
                    "absolute inset-y-0 right-0 flex items-center px-3 " +
                    (isDark
                      ? "text-neutral-500 hover:text-neutral-300"
                      : "text-neutral-400 hover:text-neutral-600")
                  }
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <label
              className={
                "flex items-center gap-2 text-sm select-none pt-1 " +
                (isDark ? "text-neutral-400" : "text-neutral-600")
              }
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 text-emerald-700 focus:ring-emerald-600"
              />
              Manter conectado
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
              }}
              className="w-full h-11 rounded-md text-white text-sm font-semibold transition-[filter,opacity] hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div
            className={
              "mt-8 pt-6 border-t text-center text-sm " +
              (isDark
                ? "border-neutral-800 text-neutral-400"
                : "border-neutral-200 text-neutral-500")
            }
          >
            Não tem uma conta?{" "}
            <a
              href="#"
              className={
                "font-semibold " +
                (isDark
                  ? "text-emerald-400 hover:text-emerald-300"
                  : "text-emerald-700 hover:text-emerald-800")
              }
            >
              Solicitar acesso
            </a>
          </div>
        </div>

        <p
          className={
            "mt-6 text-center text-xs " +
            (isDark ? "text-neutral-600" : "text-neutral-400")
          }
        >
          © {new Date().getFullYear()} Smart Green · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  isDark,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={
          "block text-sm font-medium " +
          (isDark ? "text-neutral-300" : "text-neutral-700")
        }
      >
        {label}
      </label>
      <div className="relative">
        <span
          className={
            "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none " +
            (isDark ? "text-neutral-500" : "text-neutral-400")
          }
        >
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

function inputCls(isDark: boolean, hasRightIcon: boolean) {
  const base =
    "w-full h-11 rounded-md border text-sm outline-none transition-colors pl-10 " +
    (hasRightIcon ? "pr-11 " : "pr-4 ");
  return (
    base +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-700")
  );
}
