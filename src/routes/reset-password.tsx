import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LOGO_URL =
  "https://wffylwohekfpecslflgc.supabase.co/storage/v1/object/public/files/uploads/t7QtTgpHfAeBSDZvo5b7DViqtR73/1783110032648-mkbpm-logo_smartgreen.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha · Smart Green" },
      { name: "description", content: "Crie uma nova senha para sua conta Smart Green" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasRecoveryToken = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("type") === "recovery" || query.get("type") === "recovery";
  }, []);

  useEffect(() => {
    if (!hasRecoveryToken) setError("Link de redefinição inválido ou expirado.");
  }, [hasRecoveryToken]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Senha atualizada. Já pode entrar com a nova senha.");
      setTimeout(() => navigate({ to: "/" }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a senha agora");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans flex items-center justify-center px-4 py-10 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <img src={LOGO_URL} alt="Smart Green" className="h-14 w-auto object-contain mb-5" />
          <h1 className="text-xl font-semibold tracking-tight">Redefinir senha</h1>
          <p className="text-sm mt-1 text-neutral-400">Crie uma nova senha pra sua conta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="block text-sm font-medium text-neutral-300">Nova senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full h-11 rounded-md border bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600 text-sm outline-none transition-colors pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-300"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm-new-password" className="block text-sm font-medium text-neutral-300">Confirmar senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                id="confirm-new-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full h-11 rounded-md border bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600 text-sm outline-none transition-colors pl-10 pr-4"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-emerald-500">{message}</p>}

          <button
            type="submit"
            disabled={loading || !hasRecoveryToken}
            className="w-full h-11 rounded-md text-white text-sm font-semibold transition-[filter,opacity] hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm bg-emerald-700"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}