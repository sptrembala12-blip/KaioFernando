import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatBRL, parseBRLToCentavos } from "@/lib/format";
import { Plus, Pencil, Trash2, Search, Wine, ImagePlus } from "lucide-react";
import { uploadFotoProduto } from "@/lib/upload-produto";

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
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [catAtiva, setCatAtiva] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("produtos").select("*").order("categoria").order("nome");
    setProdutos((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const categorias = useMemo(() => Array.from(new Set(produtos.map((p) => p.categoria))), [produtos]);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (catAtiva && p.categoria !== catAtiva) return false;
      if (!t) return true;
      return p.nome.toLowerCase().includes(t) || (p.descricao ?? "").toLowerCase().includes(t) || p.categoria.toLowerCase().includes(t);
    });
  }, [produtos, busca, catAtiva]);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setArquivo(null);
    setPreview(null);
    setOpen(true);
  }

  function openEdit(p: Produto) {
    setEditing(p);
    setArquivo(null);
    setPreview(p.imagem_url);
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
    setSalvando(true);
    try {
      let imagem_url = form.imagem_url || null;
      if (arquivo) imagem_url = await uploadFotoProduto(arquivo);
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        preco_centavos: parseBRLToCentavos(form.preco),
        categoria: form.categoria,
        imagem_url,
        estoque: parseInt(form.estoque) || 0,
      };
      const { error } = editing
        ? await supabase.from("produtos").update(payload).eq("id", editing.id)
        : await supabase.from("produtos").insert(payload);
      if (error) throw error;
      toast.success(editing ? "Produto atualizado" : "Produto criado");
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
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
      <div className="flex items-center justify-between mb-6 gap-3">
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="h-11 rounded-2xl bg-input/50 pl-10" />
      </div>

      {categorias.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          <button onClick={() => setCatAtiva(null)} className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium ${!catAtiva ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Tudo</button>
          {categorias.map((c) => (
            <button key={c} onClick={() => setCatAtiva((cur) => (cur === c ? null : c))} className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium ${catAtiva === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{c}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card h-40 animate-pulse" />)}</div>
      ) : visiveis.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Nenhum produto</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiveis.map((p) => (
            <div key={p.id} className={`glass-card p-4 flex gap-3 ${!p.ativo ? "opacity-50" : ""}`}>
              <div className="h-20 w-20 rounded-2xl bg-secondary overflow-hidden shrink-0 grid place-items-center">
                {p.imagem_url ? <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" /> : <Wine className="h-7 w-7 text-primary/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-primary font-medium uppercase tracking-wider">{p.categoria}</div>
                <div className="font-semibold truncate">{p.nome}</div>
                <div className="text-sm text-muted-foreground">{formatBRL(p.preco_centavos)}</div>
                <div className={`text-xs mt-1 ${p.estoque <= 0 ? "text-destructive" : p.estoque <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                  {p.estoque <= 0 ? "Esgotado" : p.estoque <= 3 ? "Últimas unidades" : `Estoque: ${p.estoque}`}
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
