import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, parseBRLToCentavos } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ShoppingBag, X, CheckCircle2, Smartphone, CreditCard, Banknote } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  categoria: string;
  imagem_url: string | null;
  estoque: number;
}
interface Mesa { id: string; numero: number; }
type ItemCarrinho = { produto: Produto; qtd: number };
type Forma = "pix" | "credito" | "debito" | "dinheiro";

export default function CardapioCliente() {
  const [params] = useSearchParams();
  const mesaHash = params.get("mesa");
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [mesaErro, setMesaErro] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<Record<string, ItemCarrinho>>({});
  const [checkout, setCheckout] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sem mesa? mostra demo: pega a primeira ativa
  useEffect(() => {
    (async () => {
      let q = supabase.from("mesas").select("id, numero").eq("ativa", true).limit(1);
      if (mesaHash) q = supabase.from("mesas").select("id, numero").eq("hash", mesaHash).eq("ativa", true).limit(1) as any;
      const { data } = await q;
      if (!data?.length) { setMesaErro(!!mesaHash); }
      else setMesa(data[0] as any);

      const { data: prods } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria").order("nome");
      setProdutos((prods ?? []) as any);
      setLoading(false);
    })();
  }, [mesaHash]);

  const categorias = useMemo(() => Array.from(new Set(produtos.map((p) => p.categoria))), [produtos]);
  const itensCarrinho = Object.values(carrinho);
  const total = itensCarrinho.reduce((s, it) => s + it.qtd * it.produto.preco_centavos, 0);
  const qtdTotal = itensCarrinho.reduce((s, it) => s + it.qtd, 0);

  function add(p: Produto) {
    if (p.estoque <= 0) return;
    setCarrinho((c) => {
      const cur = c[p.id]?.qtd ?? 0;
      if (cur + 1 > p.estoque) {
        toast.error(`Só temos ${p.estoque} de ${p.nome}`);
        return c;
      }
      return { ...c, [p.id]: { produto: p, qtd: cur + 1 } };
    });
  }
  function remove(p: Produto) {
    setCarrinho((c) => {
      const cur = c[p.id]?.qtd ?? 0;
      if (cur <= 1) { const { [p.id]: _, ...rest } = c; return rest; }
      return { ...c, [p.id]: { produto: p, qtd: cur - 1 } };
    });
  }

  async function finalizar(forma: Forma, trocoPara?: number) {
    if (!mesa) return;
    const itens = itensCarrinho.map((it) => ({
      produto_id: it.produto.id,
      nome: it.produto.nome,
      quantidade: it.qtd,
      preco_unit_centavos: it.produto.preco_centavos,
    }));
    const { data, error } = await supabase.rpc("criar_pedido_atomico", {
      _mesa_id: mesa.id,
      _itens: itens as any,
      _forma_pagamento: forma,
      _troco_para_centavos: trocoPara ?? null,
    });
    if (error) { toast.error("Erro", { description: error.message }); return; }
    const r = data as any;
    if (!r?.ok) {
      if (r?.erro === "estoque_insuficiente") {
        toast.error(`Desculpe, acabamos de vender a última unidade de ${r.produto} 🥺`, { duration: 5000 });
        // recarrega estoque
        const { data: prods } = await supabase.from("produtos").select("*").eq("ativo", true).order("categoria").order("nome");
        setProdutos((prods ?? []) as any);
      } else {
        toast.error("Não foi possível finalizar", { description: r?.erro });
      }
      return;
    }
    setCarrinho({});
    setCheckout(false);
    setSucesso(true);
    setTimeout(() => setSucesso(false), 4000);
  }

  if (mesaErro) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-gradient-glow">
        <div className="glass-card p-8 max-w-sm text-center space-y-3">
          <h2 className="text-2xl font-bold">QR inválido</h2>
          <p className="text-muted-foreground text-sm">Esta mesa não existe ou foi desativada. Peça ao garçom o QR atualizado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-gradient-glow">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border/30 safe-top">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-primary uppercase tracking-widest font-medium">LoungeMalibu</div>
            <div className="text-xl font-bold tracking-tight">
              {mesa ? <>Mesa <span className="text-gradient-amber">{mesa.numero}</span></> : "Cardápio"}
            </div>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-gradient-primary shadow-amber" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-8">
        {loading ? (
          <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-28 animate-pulse" />)}</div>
        ) : (
          categorias.map((cat) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-1">{cat}</h2>
              <div className="space-y-3">
                {produtos.filter((p) => p.categoria === cat).map((p) => {
                  const esgotado = p.estoque <= 0;
                  const noCarrinho = carrinho[p.id]?.qtd ?? 0;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      className="glass-card p-3 flex gap-3 relative overflow-hidden"
                    >
                      <div className={`relative h-24 w-24 rounded-2xl bg-secondary overflow-hidden shrink-0 ${esgotado ? "grayscale opacity-50" : ""}`}>
                        {p.imagem_url && <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />}
                        {esgotado && (
                          <div className="absolute inset-0 grid place-items-center">
                            <span className="text-[10px] uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full font-bold">Esgotado</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <h3 className="font-semibold leading-tight">{p.nome}</h3>
                        {p.descricao && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.descricao}</p>}
                        <div className="mt-auto flex items-end justify-between pt-2">
                          <span className="font-bold text-lg">{formatBRL(p.preco_centavos)}</span>
                          {esgotado ? (
                            <span className="text-xs text-destructive font-medium">Indisponível</span>
                          ) : noCarrinho > 0 ? (
                            <div className="flex items-center gap-2 glass rounded-full p-1">
                              <button onClick={() => remove(p)} className="h-8 w-8 rounded-full bg-secondary grid place-items-center ios-tap"><Minus className="h-4 w-4" /></button>
                              <span className="font-bold w-5 text-center animate-badge-pop" key={noCarrinho}>{noCarrinho}</span>
                              <button onClick={() => add(p)} className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center ios-tap"><Plus className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <button onClick={() => add(p)} className="h-9 px-4 rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold ios-tap shadow-amber flex items-center gap-1">
                              <Plus className="h-4 w-4" /> Adicionar
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Bottom bar carrinho */}
      <AnimatePresence>
        {qtdTotal > 0 && !checkout && (
          <motion.div
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-40 safe-bottom px-4 pb-4"
          >
            <button
              onClick={() => setCheckout(true)}
              className="w-full max-w-2xl mx-auto glass-strong rounded-3xl px-5 h-16 flex items-center justify-between ios-tap shadow-amber ring-amber-glow"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 rounded-2xl bg-gradient-primary grid place-items-center">
                  <ShoppingBag className="h-5 w-5 text-primary-foreground" />
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-foreground text-background text-xs font-bold grid place-items-center animate-badge-pop" key={qtdTotal}>{qtdTotal}</span>
                </div>
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">Ver pedido</div>
                  <div className="font-bold">{formatBRL(total)}</div>
                </div>
              </div>
              <span className="text-primary font-semibold">Continuar →</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout sheet */}
      <AnimatePresence>
        {checkout && mesa && (
          <CheckoutSheet
            itens={itensCarrinho}
            total={total}
            onClose={() => setCheckout(false)}
            onConfirm={finalizar}
            onAdd={add}
            onRemove={remove}
          />
        )}
      </AnimatePresence>

      {/* Sucesso */}
      <AnimatePresence>
        {sucesso && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center p-6 bg-background/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="glass-strong rounded-4xl p-8 max-w-sm text-center space-y-4"
            >
              <div className="h-16 w-16 mx-auto rounded-3xl bg-gradient-primary grid place-items-center shadow-amber">
                <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Pedido enviado!</h2>
                <p className="text-muted-foreground text-sm mt-1">O garçom já foi avisado e vai até a sua mesa.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Checkout sheet =====
function CheckoutSheet({
  itens, total, onClose, onConfirm, onAdd, onRemove,
}: {
  itens: ItemCarrinho[]; total: number; onClose: () => void;
  onConfirm: (f: Forma, troco?: number) => Promise<void>;
  onAdd: (p: Produto) => void; onRemove: (p: Produto) => void;
}) {
  const [forma, setForma] = useState<Forma | null>(null);
  const [precisaTroco, setPrecisaTroco] = useState<null | boolean>(null);
  const [trocoStr, setTrocoStr] = useState("");
  const [enviando, setEnviando] = useState(false);

  const trocoPara = parseBRLToCentavos(trocoStr);
  const trocoCalc = trocoPara - total;

  const podeConfirmar = (() => {
    if (!forma) return false;
    if (forma !== "dinheiro") return true;
    if (precisaTroco === false) return true;
    if (precisaTroco === true) return trocoPara > total;
    return false;
  })();

  async function confirmar() {
    if (!forma || !podeConfirmar) return;
    setEnviando(true);
    await onConfirm(forma, forma === "dinheiro" && precisaTroco ? trocoPara : undefined);
    setEnviando(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-2xl rounded-t-4xl sm:rounded-4xl max-h-[92vh] overflow-y-auto safe-bottom"
      >
        <div className="sticky top-0 glass-strong px-5 py-4 flex items-center justify-between border-b border-border/30">
          <h2 className="text-xl font-bold">Seu pedido</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-secondary grid place-items-center ios-tap"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <ul className="space-y-3">
            {itens.map((it) => (
              <li key={it.produto.id} className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl bg-secondary overflow-hidden shrink-0">
                  {it.produto.imagem_url && <img src={it.produto.imagem_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.produto.nome}</div>
                  <div className="text-sm text-muted-foreground">{formatBRL(it.produto.preco_centavos)}</div>
                </div>
                <div className="flex items-center gap-1.5 glass rounded-full p-1">
                  <button onClick={() => onRemove(it.produto)} className="h-7 w-7 rounded-full bg-secondary grid place-items-center"><Minus className="h-3 w-3" /></button>
                  <span className="font-bold w-5 text-center text-sm">{it.qtd}</span>
                  <button onClick={() => onAdd(it.produto)} className="h-7 w-7 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center"><Plus className="h-3 w-3" /></button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-between items-center py-3 border-y border-border/40">
            <span className="text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-gradient-amber">{formatBRL(total)}</span>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {([
                { k: "pix" as const, l: "Pix", I: Smartphone },
                { k: "credito" as const, l: "Crédito", I: CreditCard },
                { k: "debito" as const, l: "Débito", I: CreditCard },
                { k: "dinheiro" as const, l: "Dinheiro", I: Banknote },
              ]).map(({ k, l, I }) => (
                <button
                  key={k}
                  onClick={() => { setForma(k); if (k !== "dinheiro") { setPrecisaTroco(null); setTrocoStr(""); } }}
                  className={`h-14 rounded-2xl border ios-tap flex items-center justify-center gap-2 font-medium transition-all ${
                    forma === k ? "border-primary bg-primary/15 text-primary ring-amber-glow" : "border-border/50 bg-secondary/40"
                  }`}
                >
                  <I className="h-4 w-4" /> {l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">O pagamento é feito na mesa. O garçom levará a maquininha ou troco.</p>
          </div>

          {forma === "dinheiro" && (
            <div className="space-y-3 glass rounded-2xl p-4">
              <Label>Precisa de troco?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPrecisaTroco(false)}
                  className={`h-11 rounded-xl ios-tap font-medium ${precisaTroco === false ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >Não</button>
                <button
                  onClick={() => setPrecisaTroco(true)}
                  className={`h-11 rounded-xl ios-tap font-medium ${precisaTroco === true ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                >Sim</button>
              </div>
              {precisaTroco && (
                <div className="space-y-2">
                  <Label className="text-xs">Troco para quanto?</Label>
                  <Input
                    inputMode="decimal"
                    value={trocoStr}
                    onChange={(e) => setTrocoStr(e.target.value)}
                    placeholder="100,00"
                    className="rounded-xl bg-input/60 h-12 text-lg"
                  />
                  {trocoPara > 0 && (
                    <p className={`text-sm ${trocoCalc >= 0 ? "text-success" : "text-destructive"}`}>
                      {trocoCalc >= 0 ? `Troco: ${formatBRL(trocoCalc)}` : "Valor menor que o total"}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            disabled={!podeConfirmar || enviando}
            onClick={confirmar}
            className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-primary text-primary-foreground shadow-amber ios-tap disabled:opacity-40"
          >
            {enviando ? "Enviando..." : `Finalizar pedido • ${formatBRL(total)}`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
