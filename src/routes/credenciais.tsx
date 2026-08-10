import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCredenciais, type CredItem } from "@/lib/credenciais.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STORAGE_KEY = "sg-credenciais-overrides";

export const Route = createFileRoute("/credenciais")({
  head: () => ({
    meta: [
      { title: "Credenciais — SmartGreen Painel" },
      { name: "description", content: "Painel estático para visualizar e editar as credenciais de integração do SmartGreen." },
      { property: "og:title", content: "Credenciais — SmartGreen Painel" },
      { property: "og:description", content: "Visualize e edite as credenciais de integração do SmartGreen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Credenciais,
});

function Credenciais() {
  const fetchCreds = useServerFn(getCredenciais);
  const [items, setItems] = useState<CredItem[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchCreds();
        if (!alive) return;
        let overrides: Record<string, string> = {};
        try {
          overrides = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
        } catch { /* noop */ }
        setItems(data);
        setValues(Object.fromEntries(data.map((d) => [d.name, overrides[d.name] ?? d.value])));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar credenciais");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchCreds]);

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    toast.success("Credenciais salvas neste navegador");
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setValues(Object.fromEntries(items.map((d) => [d.name, d.value])));
    toast.success("Valores restaurados");
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Credenciais</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Visualize e edite as chaves de integração. As edições ficam salvas neste navegador; para valer no
        servidor, atualize o segredo correspondente no backend.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Chaves configuradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && items.map((it) => (
            <div key={it.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={it.name} className="font-mono text-xs">{it.name}</label>
                <Badge variant={it.configured ? "default" : "secondary"}>
                  {it.configured ? "configurada" : "vazia"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  id={it.name}
                  type={reveal[it.name] ? "text" : "password"}
                  value={values[it.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [it.name]: e.target.value }))}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReveal((r) => ({ ...r, [it.name]: !r[it.name] }))}
                >
                  {reveal[it.name] ? "Ocultar" : "Ver"}
                </Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button onClick={save}>Salvar</Button>
            <Button variant="outline" onClick={reset}>Restaurar</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
