import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { playCashSound } from "@/lib/sound";
import { lerPrefs, salvarPrefs, type DonoPrefs } from "@/lib/dono-prefs";
import { notificarVendaPWA, pedirPermissaoPush } from "@/lib/notify-venda";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Banknote, Bell, BellOff, BellRing, CheckCircle2, CreditCard, LogOut,
  Settings, Smartphone, Volume2, VolumeX, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Forma = "pix" | "credito" | "debito" | "dinheiro";
type Periodo = "hoje" | "7d" | "30d" | "tudo";

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

const formaIcon = {
  pix: Smartphone,
  credito: CreditCard,
  debito: CreditCard,
  dinheiro: Banknote,
} as const;

const periodos: { key: Periodo; label: string; days: number | null }[] = [
  { key: "hoje", label: "Hoje", days: 1 },
  { key: "7d", label: "7 dias", days: 7 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "tudo", label: "Tudo", days: null },
];

function desde(p: Periodo) {
  const days = periodos.find((x) => x.key === p)!.days;
  if (!days) return null;
  const d = new Date();
  if (p === "hoje") d.setHours(0, 0, 0, 0);
  else d.setTime(Date.now() - days * 86400000);
  return d.toISOString();
}

function hora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DonoApp() {
  const nav = useNavigate();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [aprovada, setAprovada] = useState<Venda | null>(null);
  const [detalhe, setDetalhe] = useState<Venda | null>(null);
  const [config, setConfig] = useState(false);
  const [prefs, setPrefs] = useState<DonoPrefs>(() => lerPrefs());
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [filtroForma, setFiltroForma] = useState<Forma | "todas">("todas");
  const [pushStatus, setPushStatus] = useState<NotificationPermission | "unsupported">("default");
  const audioCtx = useRef<AudioContext | null>(null);
  const vistos = useRef<Set<string>>(new Set());
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  function persist(next: DonoPrefs) {
    setPrefs(next);
    salvarPrefs(next);
  }

  async function desbloquearAudio() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtx.current) audioCtx.current = new Ctx();
      if (audioCtx.current.state === "suspended") await audioCtx.current.resume();
    } catch { /* ignore */ }
  }

  async function ativarPush() {
    const perm = await pedirPermissaoPush();
    setPushStatus(perm);
    persist({ ...prefsRef.current, push: perm === "granted" });
    if (perm === "granted") toast.success("Notificações ativadas.");
    else if (perm === "denied") toast.error("Permissão negada no navegador.");
    else if (perm === "unsupported") toast.error("Este aparelho não suporta notificação.");
  }

  function anunciar(venda: Venda) {
    if (vistos.current.has(venda.id)) return;
    vistos.current.add(venda.id);
    const valor = formatBRL(venda.valor_total_centavos);
    const msg = `Venda aprovada no ${valor}`;
    const desc = `Mesa ${venda.mesa_numero} · ${formaLabel[venda.forma_pagamento]}`;
    if (prefsRef.current.som) playCashSound();
    setAprovada(venda);
    toast.success(msg, { description: desc });
    if (prefsRef.current.push) void notificarVendaPWA("LoungeMalibu", `${msg} · ${desc}`, venda.id);
  }

  useEffect(() => {
    setPushStatus("Notification" in window ? Notification.permission : "unsupported");
    const unlock = () => { desbloquearAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      let q = supabase.from("pedidos").select("*").eq("status", "pago").order("paid_at", { ascending: false }).limit(200);
      const since = desde(periodo);
      if (since) q = q.gte("paid_at", since) as typeof q;
      const { data, error } = await q;
      if (cancel) return;
      if (error) toast.error(error.message);
      const lista = (data ?? []) as Venda[];
      if (periodo === "hoje") lista.forEach((v) => vistos.current.add(v.id));
      setVendas(lista);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [periodo]);

  useEffect(() => {
    const channel = supabase
      .channel("dono-vendas")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, (payload) => {
        const antes = payload.old as Partial<Venda>;
        const depois = payload.new as Venda;
        if (depois.status === "pago" && antes.status !== "pago") {
          setVendas((curr) => [depois, ...curr.filter((v) => v.id !== depois.id)]);
          anunciar(depois);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtradas = useMemo(
    () => (filtroForma === "todas" ? vendas : vendas.filter((v) => v.forma_pagamento === filtroForma)),
    [vendas, filtroForma],
  );

  const stats = useMemo(() => {
    const total = filtradas.reduce((s, v) => s + v.valor_total_centavos, 0);
    const porForma = (["pix", "credito", "debito", "dinheiro"] as Forma[]).map((f) => {
      const items = filtradas.filter((v) => v.forma_pagamento === f);
      return { f, qtd: items.length, total: items.reduce((s, v) => s + v.valor_total_centavos, 0) };
    });
    return {
      total,
      count: filtradas.length,
      ticket: filtradas.length ? Math.round(total / filtradas.length) : 0,
      porForma,
    };
  }, [filtradas]);

  async function sair() {
    await supabase.auth.signOut();
    nav("/dono/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-glow">
      <header className="sticky top-0 z-40 glass-strong border-b border-border/40 safe-top">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="" className="h-9 w-9 rounded-xl" />
            <div>
              <div className="text-base font-semibold tracking-tight leading-none">LoungeMalibu</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Painel do dono</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setConfig(true)}
              className="h-10 w-10 rounded-2xl grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary"
              aria-label="Configurações"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button onClick={sair} className="h-10 w-10 rounded-2xl grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {pushStatus === "default" && (
        <div className="max-w-lg mx-auto w-full px-4 pt-3">
          <button
            onClick={() => void ativarPush()}
            className="w-full glass-card px-4 py-3 flex items-center gap-3 text-left ios-tap ring-amber-glow"
          >
            <BellRing className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Ativar notificações</div>
              <div className="text-xs text-muted-foreground">O celular avisa quando a venda é aprovada</div>
            </div>
          </button>
        </div>
      )}

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-5 pb-12">
        <div className="glass-card p-5 ring-amber-glow">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Faturamento</div>
          <div className="text-4xl font-bold text-gradient-amber mt-1">{loading ? "…" : formatBRL(stats.total)}</div>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
            <span>{stats.count} venda{stats.count === 1 ? "" : "s"}</span>
            <span>Ticket {formatBRL(stats.ticket)}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {stats.porForma.map(({ f, qtd, total }) => {
            const Icon = formaIcon[f];
            return (
              <button
                key={f}
                onClick={() => setFiltroForma((cur) => (cur === f ? "todas" : f))}
                className={`glass-card p-2.5 text-left ios-tap ${filtroForma === f ? "ring-amber-glow" : ""}`}
              >
                <Icon className="h-3.5 w-3.5 text-primary mb-1" />
                <div className="text-[10px] text-muted-foreground">{formaLabel[f]}</div>
                <div className="text-xs font-semibold truncate">{qtd ? formatBRL(total) : "—"}</div>
              </button>
            );
          })}
        </div>

        <div className="glass rounded-2xl p-1 flex">
          {periodos.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`flex-1 h-9 rounded-xl text-xs font-medium ios-tap ${
                periodo === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-tight">Vendas</h2>
            {filtroForma !== "todas" && (
              <button onClick={() => setFiltroForma("todas")} className="text-xs text-primary">
                Limpar filtro
              </button>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-16 animate-pulse" />)}</div>
          ) : filtradas.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Bell className="h-9 w-9 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma venda neste período.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtradas.map((v) => {
                const Icon = formaIcon[v.forma_pagamento];
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => setDetalhe(v)}
                      className="w-full glass-card px-4 py-3 flex items-center gap-3 text-left ios-tap"
                    >
                      <div className="h-10 w-10 rounded-2xl bg-secondary grid place-items-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">Mesa {v.mesa_numero}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formaLabel[v.forma_pagamento]} · {hora(v.paid_at)} · {v.itens.reduce((s, i) => s + i.quantidade, 0)} iten{v.itens.reduce((s, i) => s + i.quantidade, 0) === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="font-bold">{formatBRL(v.valor_total_centavos)}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <AnimatePresence>
        {aprovada && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center p-6 bg-background/70 backdrop-blur-md" onClick={() => setAprovada(null)}>
            <motion.div
              initial={{ scale: 0.84, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-4xl p-8 max-w-sm w-full text-center space-y-4 ring-amber-glow"
            >
              <div className="h-16 w-16 mx-auto rounded-3xl bg-gradient-primary grid place-items-center shadow-amber animate-glow-pulse">
                <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <div className="text-[11px] tracking-[0.2em] uppercase text-primary">LoungeMalibu</div>
                <h2 className="text-2xl font-bold mt-1">Venda aprovada no {formatBRL(aprovada.valor_total_centavos)}</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Mesa {aprovada.mesa_numero} · {formaLabel[aprovada.forma_pagamento]}
                </p>
              </div>
              <Button onClick={() => { setAprovada(null); setDetalhe(aprovada); }} variant="ghost" className="w-full rounded-2xl">
                Ver detalhes
              </Button>
              <Button onClick={() => setAprovada(null)} className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold">
                OK
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detalhe && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setDetalhe(null)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-lg rounded-t-4xl max-h-[88vh] overflow-y-auto safe-bottom"
            >
              <div className="sticky top-0 glass-strong px-5 py-4 flex items-center justify-between border-b border-border/30">
                <div>
                  <div className="text-xs text-muted-foreground">Venda</div>
                  <div className="text-lg font-bold">Mesa {detalhe.mesa_numero}</div>
                </div>
                <button onClick={() => setDetalhe(null)} className="h-9 w-9 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
              </div>
              <div className="p-5 space-y-5">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-3xl font-bold text-gradient-amber">{formatBRL(detalhe.valor_total_centavos)}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{formaLabel[detalhe.forma_pagamento]}</div>
                    <div className="text-muted-foreground text-xs">{hora(detalhe.paid_at)}</div>
                  </div>
                </div>
                <ul className="space-y-2 border-t border-border/40 pt-4">
                  {detalhe.itens.map((it, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span>{it.quantidade}× {it.nome}</span>
                      <span className="text-muted-foreground">{formatBRL(it.quantidade * it.preco_unit_centavos)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {config && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setConfig(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-lg rounded-t-4xl p-5 pb-8 space-y-5 safe-bottom"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Configurações</h2>
                <button onClick={() => setConfig(false)} className="h-9 w-9 rounded-full bg-secondary grid place-items-center"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex items-center justify-between glass-card px-4 py-3">
                <div className="flex items-center gap-3">
                  {prefs.som ? <Volume2 className="h-5 w-5 text-primary" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <div className="font-medium text-sm">Som de venda</div>
                    <div className="text-xs text-muted-foreground">Cash ao confirmar pagamento</div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const next = { ...prefs, som: !prefs.som };
                    persist(next);
                    if (next.som) { await desbloquearAudio(); playCashSound(); }
                  }}
                  className={`h-8 w-14 rounded-full p-1 transition-colors ${prefs.som ? "bg-primary" : "bg-secondary"}`}
                >
                  <div className={`h-6 w-6 rounded-full bg-white transition-transform ${prefs.som ? "translate-x-6" : ""}`} />
                </button>
              </div>

              <div className="flex items-center justify-between glass-card px-4 py-3">
                <div className="flex items-center gap-3">
                  {prefs.push && pushStatus === "granted" ? <BellRing className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <div className="font-medium text-sm">Notificação push</div>
                    <div className="text-xs text-muted-foreground">
                      {pushStatus === "granted" ? "Ativa neste aparelho" : pushStatus === "denied" ? "Bloqueada no navegador" : "Toque para permitir"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!prefs.push || pushStatus !== "granted") await ativarPush();
                    else persist({ ...prefs, push: false });
                  }}
                  className={`h-8 w-14 rounded-full p-1 transition-colors ${prefs.push && pushStatus === "granted" ? "bg-primary" : "bg-secondary"}`}
                >
                  <div className={`h-6 w-6 rounded-full bg-white transition-transform ${prefs.push && pushStatus === "granted" ? "translate-x-6" : ""}`} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
