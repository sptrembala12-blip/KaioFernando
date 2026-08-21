import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { TrendingUp, ShoppingBag, DollarSign } from "lucide-react";

type Range = "1d" | "7d" | "30d" | "3m";
const ranges: Array<{ key: Range; label: string; days: number }> = [
  { key: "1d", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "3m", label: "3 meses", days: 90 },
];

interface PedidoPago {
  id: string;
  valor_total_centavos: number;
  itens: Array<{ produto_id: string; nome: string; quantidade: number; preco_unit_centavos: number }>;
  paid_at: string;
}

export default function AdminDashboard() {
  const [range, setRange] = useState<Range>("7d");
  const [pedidos, setPedidos] = useState<PedidoPago[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const days = ranges.find((r) => r.key === range)!.days;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await supabase
        .from("pedidos")
        .select("id, valor_total_centavos, itens, paid_at")
        .eq("status", "pago")
        .gte("paid_at", since)
        .order("paid_at", { ascending: false });
      setPedidos((data ?? []) as any);
      setLoading(false);
    })();
  }, [range]);

  const stats = useMemo(() => {
    const total = pedidos.reduce((s, p) => s + p.valor_total_centavos, 0);
    const count = pedidos.length;
    const ticket = count ? total / count : 0;
    const porProduto = new Map<string, { nome: string; qtd: number; total: number }>();
    pedidos.forEach((p) =>
      p.itens.forEach((it) => {
        const cur = porProduto.get(it.produto_id) ?? { nome: it.nome, qtd: 0, total: 0 };
        cur.qtd += it.quantidade;
        cur.total += it.quantidade * it.preco_unit_centavos;
        porProduto.set(it.produto_id, cur);
      })
    );
    const ranking = Array.from(porProduto.values()).sort((a, b) => b.total - a.total);
    return { total, count, ticket, ranking };
  }, [pedidos]);

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Faturamento e produtos mais vendidos</p>
        </div>
        <div className="glass rounded-2xl p-1 flex">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-4 h-9 rounded-xl text-sm font-medium ios-tap transition-colors ${
                range === r.key ? "bg-primary text-primary-foreground shadow-amber" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Faturamento" value={formatBRL(stats.total)} loading={loading} accent />
        <StatCard icon={ShoppingBag} label="Pedidos pagos" value={String(stats.count)} loading={loading} />
        <StatCard icon={TrendingUp} label="Ticket médio" value={formatBRL(Math.round(stats.ticket))} loading={loading} />
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Lucro por produto</h2>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : stats.ranking.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma venda no período.</p>
        ) : (
          <ul className="space-y-2">
            {stats.ranking.map((p, i) => {
              const max = stats.ranking[0].total;
              const pct = (p.total / max) * 100;
              return (
                <li key={i} className="relative rounded-2xl bg-secondary/50 p-3 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-gradient-primary/15" style={{ width: `${pct}%` }} />
                  <div className="relative flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">{p.qtd} unidade{p.qtd > 1 ? "s" : ""} vendida{p.qtd > 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatBRL(p.total)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, loading, accent }: { icon: any; label: string; value: string; loading: boolean; accent?: boolean }) {
  return (
    <div className={`glass-card p-5 ${accent ? "ring-amber-glow" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`h-9 w-9 rounded-2xl grid place-items-center ${accent ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`text-3xl font-bold ${accent ? "text-gradient-amber" : ""}`}>
        {loading ? <span className="inline-block h-8 w-32 rounded-lg bg-muted animate-pulse" /> : value}
      </div>
    </div>
  );
}
