import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  return (
    <div className="min-h-screen font-sans flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-lime-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)] border border-emerald-100 p-8 sm:p-10">
          <div className="flex flex-col items-center mb-8">
            <img
              src={LOGO_URL}
              alt="Smart Green"
              className="h-16 w-auto object-contain mb-4"
            />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Entre na sua conta Smart Green
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Senha
                </label>
                <a href="#" className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 rounded-lg border border-slate-200 bg-white px-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Manter conectado
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <p className="mt-8 text-center text-sm text-slate-500">
            Não tem uma conta?{" "}
            <a href="#" className="font-semibold text-emerald-600 hover:text-emerald-700">
              Criar conta
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Smart Green. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
