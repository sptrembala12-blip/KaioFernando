import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatBRL, parseBRLToCentavos } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  categoria: string;
  imagem_url: string | null;
  estoque: number;
  ativo: boolean;
}

const empty = { nome: "", descricao: "", preco: "", categoria: "Bebidas", imagem_url: "", estoque: "0" };

export default function AdminProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(empty);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("produtos").select("*").order("categoria").order("nome");
    setProdutos((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(p: Produto) {
    setEditing(p);
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? "",
      preco: (p.preco_centavos / 100).toFixed(2).replace(".", ","),
      categoria: p.categoria,
      imagem_url: p.imagem_url ?? "",
      estoque: String(p.estoque),
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      preco_centavos: parseBRLToCentavos(form.preco),
      categoria: form.categoria,
      imagem_url: form.imagem_url || null,
      estoque: parseInt(form.estoque) || 0,
    };
    const { error } = editing
      ? await supabase.from("produtos").update(payload).eq("id", editing.id)
      : await supabase.from("produtos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Produto atualizado" : "Produto criado");
    setOpen(false);
    load();
  }

  async function remove(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Produto desativado");
    load();
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">{produtos.length} no catálogo</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-amber ios-tap">
              <Plus className="h-4 w-4 mr-2" /> Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/40 rounded-3xl max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="rounded-xl bg-input/60" /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="rounded-xl bg-input/60" rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Preço (R$)</Label><Input required value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} placeholder="22,50" className="rounded-xl bg-input/60" /></div>
                <div className="space-y-2"><Label>Estoque</Label><Input required type="number" min={0} value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} className="rounded-xl bg-input/60" /></div>
              </div>
              <div className="space-y-2"><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="rounded-xl bg-input/60" /></div>
              <div className="space-y-2"><Label>URL da imagem</Label><Input value={form.imagem_url} onChange={(e) => setForm({ ...form, imagem_url: e.target.value })} placeholder="https://…" className="rounded-xl bg-input/60" /></div>
              <Button type="submit" className="w-full h-11 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold ios-tap">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card h-40 animate-pulse" />)}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((p) => (
            <div key={p.id} className={`glass-card p-4 flex gap-3 ${!p.ativo ? "opacity-50" : ""}`}>
              <div className="h-20 w-20 rounded-2xl bg-secondary overflow-hidden shrink-0">
                {p.imagem_url && <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-primary font-medium uppercase tracking-wider">{p.categoria}</div>
                <div className="font-semibold truncate">{p.nome}</div>
                <div className="text-sm text-muted-foreground">{formatBRL(p.preco_centavos)}</div>
                <div className={`text-xs mt-1 ${p.estoque <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  Estoque: {p.estoque}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)} className="rounded-xl h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p)} className="rounded-xl h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
