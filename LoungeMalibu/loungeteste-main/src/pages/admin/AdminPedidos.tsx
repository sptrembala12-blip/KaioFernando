import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { playNotificationSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, Banknote, CreditCard, Smartphone, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Pedido {
  id: string;
  mesa_numero: number;
  itens: Array<{ nome: string; quantidade: number; preco_unit_centavos: number }>;
  valor_total_centavos: number;
  forma_pagamento: "pix" | "credito" | "debito" | "dinheiro";
  troco_para_centavos: number | null;
  status: "pendente" | "pago" | "cancelado";
  created_at: string;
}

const formaIcon = {
  pix: Smartphone,
  credito: CreditCard,
  debito: CreditCard,
  dinheiro: Banknote,
} as const;

const formaLabel = { pix: "Pix", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" } as const;

export default function AdminPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<Pedido | null>(null);
  const audioUnlocked = useRef(false);

  // Desbloqueia áudio no primeiro clique (autoplay policy)
  useEffect(() => {
    const unlock = () => { audioUnlocked.current = true; window.removeEventListener("click", unlock); };
    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setPedidos((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();

    const channel = supabase
      .channel("pedidos-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        (payload) => {
          const novo = payload.new as Pedido;
          setPedidos((curr) => [novo, ...curr]);
          if (audioUnlocked.current) playNotificationSound();
          setPopup(novo);
          toast.success(`Mesa ${novo.mesa_numero} fez um pedido`, {
            description: formatBRL(novo.valor_total_centavos),
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
        (payload) => {
          const upd = payload.new as Pedido;
          setPedidos((curr) =>
            upd.status === "pendente"
              ? curr.map((p) => (p.id === upd.id ? upd : p))
              : curr.filter((p) => p.id !== upd.id)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function confirmar(p: Pedido) {
    const { error } = await supabase
      .from("pedidos")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) toast.error(error.message);
    else toast.success(`Mesa ${p.mesa_numero}: pagamento confirmado`);
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos ao vivo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recebe novos pedidos em tempo real • {pedidos.length} pendente{pedidos.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 glass rounded-2xl px-4 py-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-muted-foreground">Ouvindo eventos…</span>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card h-56 animate-pulse" />
          ))}
        </div>
      ) : pedidos.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum pedido pendente. Aguardando clientes…</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {pedidos.map((p) => {
              const Icon = formaIcon[p.forma_pagamento];
              const troco = p.forma_pagamento === "dinheiro" && p.troco_para_centavos
                ? p.troco_para_centavos - p.valor_total_centavos
                : null;
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="glass-card p-5 space-y-4 hover:ring-amber-glow transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Mesa</div>
                      <div className="text-4xl font-bold text-gradient-amber">{p.mesa_numero}</div>
                    </div>
                    <Badge variant="outline" className="rounded-full gap-1.5 border-primary/30 text-primary">
                      <Icon className="h-3 w-3" /> {formaLabel[p.forma_pagamento]}
                    </Badge>
                  </div>

                  <ul className="space-y-1.5 text-sm border-t border-border/40 pt-3">
                    {p.itens.map((it, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="text-foreground">{it.quantidade}× {it.nome}</span>
                        <span className="text-muted-foreground">{formatBRL(it.quantidade * it.preco_unit_centavos)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-end justify-between pt-2 border-t border-border/40">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-2xl font-bold">{formatBRL(p.valor_total_centavos)}</div>
                  </div>

                  {troco !== null && troco > 0 && (
                    <div className="rounded-2xl bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
                      <div className="text-muted-foreground text-xs">Troco para {formatBRL(p.troco_para_centavos!)}</div>
                      <div className="font-semibold text-primary">Levar {formatBRL(troco)} de troco</div>
                    </div>
                  )}

                  <Button
                    onClick={() => confirmar(p)}
                    className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold ios-tap shadow-amber"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar pagamento
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Popup novo pedido */}
      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center p-6 bg-background/60 backdrop-blur-sm"
            onClick={() => setPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-4xl p-8 max-w-md w-full ring-amber-glow space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-3xl bg-gradient-primary grid place-items-center shadow-amber animate-glow-pulse">
                  <Bell className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-primary">Novo pedido</div>
                  <div className="text-2xl font-bold">Mesa {popup.mesa_numero}</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span className="font-medium">{formaLabel[popup.forma_pagamento]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span className="font-medium">{popup.itens.reduce((s, i) => s + i.quantidade, 0)}</span></div>
                <div className="flex justify-between text-lg pt-2 border-t border-border/40"><span>Total</span><span className="font-bold text-gradient-amber">{formatBRL(popup.valor_total_centavos)}</span></div>
                {popup.forma_pagamento === "dinheiro" && popup.troco_para_centavos && (
                  <div className="rounded-2xl bg-primary/10 border border-primary/20 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Troco</div>
                    <div className="font-semibold text-primary">Levar {formatBRL(popup.troco_para_centavos - popup.valor_total_centavos)}</div>
                  </div>
                )}
              </div>
              <Button onClick={() => setPopup(null)} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold">OK</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
