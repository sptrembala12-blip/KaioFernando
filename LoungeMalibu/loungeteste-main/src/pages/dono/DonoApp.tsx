import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { playCashSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Banknote, Bell, CheckCircle2, LogOut, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Forma = "pix" | "credito" | "debito" | "dinheiro";
interface Venda {
  id: string;
  mesa_numero: number;
  itens: Array<{ nome: string; quantidade: number; preco_unit_centavos: number }>;
  valor_total_centavos: number;
  forma_pagamento: Forma;
  paid_at: string | null;
  created_at: string;
  status: "pendente" | "pago" | "cancelado";
}

const formaLabel: Record<Forma, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
};

function inicioDoDia() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function DonoApp() {
  const nav = useNavigate();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [aprovada, setAprovada] = useState<Venda | null>(null);
  const [somOk, setSomOk] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const vistos = useRef<Set<string>>(new Set());

  function desbloquearSom() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtx.current) audioCtx.current = new Ctx();
      if (audioCtx.current.state === "suspended") audioCtx.current.resume();
      setSomOk(true);
    } catch {
      setSomOk(true);
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function anunciar(venda: Venda) {
    if (vistos.current.has(venda.id)) return;
    vistos.current.add(venda.id);
    const valor = formatBRL(venda.valor_total_centavos);
    const msg = `Venda aprovada no ${valor}`;
    playCashSound();
    setAprovada(venda);
    toast.success(msg, { description: `Mesa ${venda.mesa_numero} · ${formaLabel[venda.forma_pagamento]}` });
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(msg, {
          body: `Mesa ${venda.mesa_numero} · ${formaLabel[venda.forma_pagamento]}`,
          icon: "/favicon.png",
          tag: venda.id,
          silent: true,
        });
        setTimeout(() => n.close(), 8000);
      } catch {
        /* ignore */
      }
    }
  }

  useEffect(() => {
    const unlock = () => desbloquearSom();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("status", "pago")
        .gte("paid_at", inicioDoDia())
        .order("paid_at", { ascending: false });
      if (error) toast.error(error.message);
      const lista = (data ?? []) as Venda[];
      lista.forEach((v) => vistos.current.add(v.id));
      setVendas(lista);
      setLoading(false);
    })();

    const channel = supabase
      .channel("dono-vendas")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
        (payload) => {
          const antes = payload.old as Partial<Venda>;
          const depois = payload.new as Venda;
          if (depois.status === "pago" && antes.status !== "pago") {
            setVendas((curr) => [depois, ...curr.filter((v) => v.id !== depois.id)]);
            anunciar(depois);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const total = vendas.reduce((s, v) => s + v.valor_total_centavos, 0);
    return { total, count: vendas.length, ticket: vendas.length ? Math.round(total / vendas.length) : 0 };
  }, [vendas]);

  async function sair() {
    await supabase.auth.signOut();
    nav("/dono/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-glow">
      <header className="sticky top-0 z-40 glass-strong border-b border-border/40 safe-top">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">Área do dono</div>
            <div className="text-lg font-bold tracking-tight leading-tight">
              Lounge<span className="text-primary">OS</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!somOk && (
              <Button size="sm" onClick={desbloquearSom} className="rounded-2xl h-9 bg-gradient-primary text-primary-foreground">
                <Volume2 className="h-4 w-4 mr-1" /> Som
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={sair} className="rounded-2xl h-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-5 pb-10">
        <div className="glass-card p-5 ring-amber-glow">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Faturamento de hoje</div>
          <div className="text-4xl font-bold text-gradient-amber mt-1">
            {loading ? "…" : formatBRL(stats.total)}
          </div>
          <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
            <span>{stats.count} venda{stats.count === 1 ? "" : "s"}</span>
            <span>Ticket {formatBRL(stats.ticket)}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground px-1">
          Notifica só quando o admin confirma o pagamento na mão. Pedido novo não conta como venda.
        </p>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Vendas de hoje</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-card h-16 animate-pulse" />
              ))}
            </div>
          ) : vendas.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma venda aprovada hoje.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {vendas.map((v) => (
                <li key={v.id} className="glass-card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">Mesa {v.mesa_numero}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {formaLabel[v.forma_pagamento]} ·{" "}
                      {v.paid_at
                        ? new Date(v.paid_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </div>
                  </div>
                  <div className="font-bold text-lg">{formatBRL(v.valor_total_centavos)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <AnimatePresence>
        {aprovada && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center p-6 bg-background/70 backdrop-blur-md"
            onClick={() => setAprovada(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-4xl p-8 max-w-sm w-full text-center space-y-4 ring-amber-glow"
            >
              <div className="h-16 w-16 mx-auto rounded-3xl bg-gradient-primary grid place-items-center shadow-amber animate-glow-pulse">
                <Banknote className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-primary font-semibold">Caixa</div>
                <h2 className="text-2xl font-bold mt-1">Venda aprovada no {formatBRL(aprovada.valor_total_centavos)}</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Mesa {aprovada.mesa_numero} · {formaLabel[aprovada.forma_pagamento]}
                </p>
              </div>
              <Button
                onClick={() => setAprovada(null)}
                className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> OK
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
