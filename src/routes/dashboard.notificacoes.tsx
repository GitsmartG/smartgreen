import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Send,
  Calendar,
  Users2,
  Bell,
  Smartphone,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useIsDark } from "@/hooks/use-is-dark";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/notificacoes")({
  component: NotificacoesPage,
});

const MODELOS = [
  { label: "Nova tip disponível!", title: "Nova tip disponível!", msg: "Confira agora a nova dica do dia no app 🚀" },
  { label: "Oferta especial — Assinatura Pro", title: "Oferta especial 🔥", msg: "Assine o plano Pro com desconto exclusivo por tempo limitado." },
  { label: "Assinatura expirando", title: "Sua assinatura está expirando", msg: "Renove agora e não perca acesso às tips premium." },
  { label: "Manutenção programada", title: "Manutenção programada", msg: "Nosso app passará por manutenção hoje à noite. Volte em breve!" },
];

const CATEGORIAS = ["Nova Tip", "Promoção", "Sistema", "Assinatura"];
const PUBLICOS = [
  { value: "todos", label: "Todos os Usuários", alcance: 0 },
  { value: "admins", label: "Apenas Administradores", alcance: 0 },
  { value: "assinantes", label: "Apenas Assinantes", alcance: 0 },
  { value: "free", label: "Usuários Free", alcance: 0 },
  { value: "inativos", label: "Inativos há 7 dias", alcance: 0 },
];

function NotificacoesPage() {
  const isDark = useIsDark();

  const panel = isDark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const inner = isDark ? "bg-neutral-950/50 border-neutral-800" : "bg-neutral-50 border-neutral-200";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const subtle = isDark ? "text-neutral-500" : "text-neutral-500";

  const fieldCls =
    "h-10 w-full rounded-md border px-3 text-sm outline-none transition-colors " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-700");
  const areaCls =
    "w-full rounded-md border p-3 text-sm outline-none transition-colors resize-none " +
    (isDark
      ? "bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-600"
      : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-700");
  const chipCls =
    "text-left px-3 py-2 rounded-md border text-xs font-medium transition-colors " +
    (isDark
      ? "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-emerald-700 hover:bg-neutral-800"
      : "border-neutral-200 bg-white text-neutral-700 hover:border-emerald-600 hover:bg-neutral-50");

  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [publico, setPublico] = useState("todos");
  const [agendar, setAgendar] = useState(false);
  const [dataAgendada, setDataAgendada] = useState("");
  const [alcance, setAlcance] = useState(0);
  const [loadingAlcance, setLoadingAlcance] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  type HistItem = {
    id: string;
    titulo: string;
    categoria: string;
    publico: string;
    entregue: number;
    status: "enviada" | "agendada" | "falha";
    data: string;
  };
  const [historico, setHistorico] = useState<HistItem[]>([]);

  // Carrega alcance estimado
  useEffect(() => {
    const fetchAlcance = async () => {
      setLoadingAlcance(true);
      try {
        if (publico === "todos") {
          const { count, error } = await supabase
            .from("user_fcm_tokens")
            .select("*", { count: "exact", head: true });
          if (!error) setAlcance(count || 0);
        } else if (publico === "admins") {
          const { data: admins } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          const adminIds = (admins || []).map((a) => a.user_id);
          if (adminIds.length === 0) {
            setAlcance(0);
          } else {
            const { count, error } = await supabase
              .from("user_fcm_tokens")
              .select("*", { count: "exact", head: true })
              .in("user_id", adminIds);
            if (!error) setAlcance(count || 0);
          }
        } else if (publico === "assinantes") {
          const { data: premium } = await supabase
            .from("profiles")
            .select("id")
            .gt("access_expires_at", new Date().toISOString());
          const premiumIds = (premium || []).map((p) => p.id);
          if (premiumIds.length === 0) {
            setAlcance(0);
          } else {
            const { count, error } = await supabase
              .from("user_fcm_tokens")
              .select("*", { count: "exact", head: true })
              .in("user_id", premiumIds);
            if (!error) setAlcance(count || 0);
          }
        } else if (publico === "free") {
          const { data: free } = await supabase
            .from("profiles")
            .select("id")
            .or(`access_expires_at.is.null,access_expires_at.lte.${new Date().toISOString()}`);
          const freeIds = (free || []).map((f) => f.id);
          if (freeIds.length === 0) {
            setAlcance(0);
          } else {
            const { count, error } = await supabase
              .from("user_fcm_tokens")
              .select("*", { count: "exact", head: true })
              .in("user_id", freeIds);
            if (!error) setAlcance(count || 0);
          }
        } else {
          setAlcance(0);
        }
      } catch (err) {
        console.error("Error fetching reach:", err);
      } finally {
        setLoadingAlcance(false);
      }
    };
    fetchAlcance();
  }, [publico]);

  const publicoLabel = PUBLICOS.find((p) => p.value === publico)?.label ?? "";

  const canSend = titulo.trim().length > 0 && mensagem.trim().length > 0;

  // Carrega histórico de notificações do banco de dados
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("push_notifications_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const items: HistItem[] = (data || []).map((d) => ({
        id: d.id,
        titulo: d.title,
        categoria: d.category || "Geral",
        publico: PUBLICOS.find((p) => p.value === d.target_audience)?.label || d.target_audience,
        entregue: d.sent_count || 0,
        status: d.status as "enviada" | "agendada" | "falha",
        data: new Date(d.created_at).toLocaleString("pt-BR"),
      }));
      setHistorico(items);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const stats = useMemo(() => {
    let totalEntregue = 0;
    let ultimos7Dias = 0;
    let agendadas = 0;
    let falhas = 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    historico.forEach((h) => {
      totalEntregue += h.entregue;
      if (h.status === "agendada") agendadas++;
      if (h.status === "falha") falhas++;

      try {
        const parts = h.data.split(",")[0].split("/");
        const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (date >= sevenDaysAgo) {
          ultimos7Dias += h.entregue;
        }
      } catch {
        // fallback
      }
    });

    return { totalEntregue, ultimos7Dias, agendadas, falhas };
  }, [historico]);

  const enviar = async () => {
    if (!canSend || enviando) return;
    setEnviando(true);

    const loadingToast = toast.loading("Enviando notificações push...");
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          titulo,
          mensagem,
          categoria,
          publico,
        },
      });

      toast.dismiss(loadingToast);

      if (error) {
        throw new Error(error.message || "Erro no envio");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(
        `Notificação enviada! Sucesso: ${data.sent_count || 0}, Falhas: ${data.failed_count || 0}`
      );

      setTitulo("");
      setMensagem("");
      fetchHistory();
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error("Error sending notification:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar notificações");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Notificações Push</h2>
        <p className={`text-xs ${muted} mt-0.5`}>
          Envie ou agende mensagens push e acompanhe a entrega em tempo real.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard panel={panel} muted={muted} icon={<Send className="h-5 w-5" />} color="emerald" label="Total entregue" value={String(stats.totalEntregue)} />
        <StatCard panel={panel} muted={muted} icon={<Activity className="h-5 w-5" />} color="neutral" label="Últimos 7 dias" value={String(stats.ultimos7Dias)} />
        <StatCard panel={panel} muted={muted} icon={<Calendar className="h-5 w-5" />} color="neutral" label="Agendadas" value={String(stats.agendadas)} />
        <StatCard panel={panel} muted={muted} icon={<XCircle className="h-5 w-5" />} color="red" label="Com falha" value={String(stats.falhas)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Criar Notificação */}
        <div className={`rounded-xl border p-5 ${panel} space-y-4`}>
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold">Criar Notificação</h3>
            </div>
            <p className={`text-xs ${muted} mt-0.5`}>Preencha os detalhes e envie ou agende.</p>
          </div>

          <div>
            <div className={`text-[10px] uppercase tracking-wider ${subtle} mb-2`}>Modelos rápidos</div>
            <div className="grid grid-cols-2 gap-2">
              {MODELOS.map((m) => (
                <button
                  key={m.label}
                  onClick={() => {
                    setTitulo(m.title);
                    setMensagem(m.msg);
                  }}
                  className={chipCls}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`text-xs ${muted}`}>Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={fieldCls + " mt-1"}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-xs ${muted}`}>Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título da notificação..."
              className={fieldCls + " mt-1"}
              maxLength={80}
            />
          </div>

          <div>
            <label className={`text-xs ${muted}`}>Mensagem</label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value.slice(0, 300))}
              placeholder="Escreva o texto da sua notificação..."
              rows={4}
              className={areaCls + " mt-1"}
            />
            <div className={`text-[11px] text-right ${subtle}`}>{mensagem.length}/300</div>
          </div>

          <div>
            <label className={`text-xs ${muted} inline-flex items-center gap-1.5`}>
              <Users2 className="h-3.5 w-3.5" /> Público
            </label>
            <select value={publico} onChange={(e) => setPublico(e.target.value)} className={fieldCls + " mt-1"}>
              {PUBLICOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className={`text-[11px] ${muted} mt-1.5 inline-flex items-center gap-1`}>
              <Users2 className="h-3 w-3" /> Alcance estimado:{" "}
              <span className="text-emerald-500 font-semibold">
                {loadingAlcance ? "carregando..." : `${alcance} aparelhos`}
              </span>
              <span className={subtle}>(com push ativado)</span>
            </div>
          </div>

          {/* Agendar */}
          <div className={`rounded-lg border ${inner} p-3`}>
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4" /> Agendar para depois
              </div>
              <button
                onClick={() => setAgendar((v) => !v)}
                className={
                  "relative h-6 w-11 rounded-full transition-colors " +
                  (agendar ? "bg-emerald-500" : isDark ? "bg-neutral-700" : "bg-neutral-300")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform " +
                    (agendar ? "translate-x-5" : "translate-x-0.5")
                  }
                />
              </button>
            </div>
            {agendar && (
              <input
                type="datetime-local"
                value={dataAgendada}
                onChange={(e) => setDataAgendada(e.target.value)}
                className={fieldCls + " mt-3"}
              />
            )}
          </div>

          {/* Preview */}
          <div className={`rounded-lg border ${inner} p-3`}>
            <div className={`text-[10px] uppercase tracking-wider ${subtle} inline-flex items-center gap-1.5 mb-2`}>
              <Smartphone className="h-3 w-3" /> Pré-visualização
            </div>
            <div
              className={
                "rounded-lg p-3 flex items-start gap-3 " +
                (isDark ? "bg-neutral-900 border border-neutral-800" : "bg-white border border-neutral-200 shadow-sm")
              }
            >
              <div className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {titulo || "Título da Notificação"}
                </div>
                <div className={`text-xs ${muted} line-clamp-2`}>
                  {mensagem || "Sua mensagem aparecerá aqui..."}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={enviar}
            disabled={!canSend || enviando}
            style={
              canSend && !enviando
                ? {
                    backgroundImage: "linear-gradient(90deg, #0f5f2a 0%, #1f8a3a 55%, #54ee2b 100%)",
                  }
                : undefined
            }
            className={
              "h-11 w-full rounded-md text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition " +
              (canSend && !enviando
                ? "hover:brightness-110 active:brightness-95 shadow-sm"
                : "bg-neutral-700 opacity-50 cursor-not-allowed")
            }
          >
            <Zap className="h-4 w-4" />
            {enviando ? "Enviando..." : agendar ? "Agendar Envio" : "Enviar Agora"}
          </button>
        </div>

        {/* Histórico */}
        <div className={`rounded-xl border p-5 ${panel}`}>
          <div>
            <h3 className="font-semibold">Histórico</h3>
            <p className={`text-xs ${muted} mt-0.5`}>
              Atualiza em tempo real conforme notificações são enviadas.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead
                className={
                  "text-[11px] uppercase tracking-wider " +
                  (isDark ? "text-neutral-500" : "text-neutral-500")
                }
              >
                <tr className={"border-b " + (isDark ? "border-neutral-800" : "border-neutral-200")}>
                  <th className="text-left font-medium py-2 pr-3">Título</th>
                  <th className="text-left font-medium py-2 pr-3">Categoria</th>
                  <th className="text-left font-medium py-2 pr-3">Público</th>
                  <th className="text-left font-medium py-2 pr-3">Entregue</th>
                  <th className="text-left font-medium py-2 pr-3">Status</th>
                  <th className="text-left font-medium py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`text-center py-16 ${muted}`}>
                      <div className="inline-flex items-center gap-2">
                        <Activity className="h-4 w-4" /> Nenhuma notificação enviada ainda.
                      </div>
                    </td>
                  </tr>
                )}
                {historico.map((h) => (
                  <tr key={h.id} className={"border-b " + (isDark ? "border-neutral-800" : "border-neutral-200")}>
                    <td className="py-3 pr-3 font-medium">{h.titulo}</td>
                    <td className={`py-3 pr-3 ${muted}`}>{h.categoria}</td>
                    <td className={`py-3 pr-3 ${muted}`}>{h.publico}</td>
                    <td className="py-3 pr-3">{h.entregue}</td>
                    <td className="py-3 pr-3">
                      {h.status === "enviada" && (
                        <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Enviada
                        </span>
                      )}
                      {h.status === "agendada" && (
                        <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-semibold">
                          <Calendar className="h-3.5 w-3.5" /> Agendada
                        </span>
                      )}
                      {h.status === "falha" && (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                          <XCircle className="h-3.5 w-3.5" /> Falha
                        </span>
                      )}
                    </td>
                    <td className={`py-3 ${muted}`}>{h.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  panel,
  muted,
  icon,
  color,
  label,
  value,
}: {
  panel: string;
  muted: string;
  icon: React.ReactNode;
  color: "emerald" | "red" | "neutral";
  label: string;
  value: string;
}) {
  const badge =
    color === "emerald"
      ? "bg-emerald-500/15 text-emerald-500"
      : color === "red"
        ? "bg-red-500/15 text-red-500"
        : "bg-neutral-500/15 text-neutral-400";
  const valColor = color === "emerald" ? "text-emerald-500" : color === "red" ? "text-red-500" : "";
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${panel}`}>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${badge}`}>{icon}</div>
      <div>
        <div className={`text-[10px] uppercase tracking-wider ${muted}`}>{label}</div>
        <div className={`text-2xl font-bold ${valColor}`}>{value}</div>
      </div>
    </div>
  );
}
