import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSupabaseConfig } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SetupSupabase({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim();
    const k = key.trim();
    if (!u.startsWith("https://") || !u.includes("supabase.co")) {
      toast.error("URL inválida", { description: "Cole a Project URL (https://xxxx.supabase.co)" });
      return;
    }
    if (k.length < 30) {
      toast.error("Chave inválida", { description: "Cole a anon public key" });
      return;
    }
    setSupabaseConfig(u, k);
    toast.success("Projeto conectado");
    onSaved();
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-gradient-glow">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.png" alt="" className="h-16 w-16 rounded-2xl shadow-amber mb-5" />
          <h1 className="text-[13px] tracking-[0.22em] uppercase text-primary/90 font-medium">LoungeMalibu</h1>
          <p className="mt-2 text-2xl font-semibold tracking-tight">Conectar Supabase</p>
        </div>

        <form onSubmit={salvar} className="glass-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Conta antiga removida. Crie um projeto novo em supabase.com (pode entrar com GitHub), depois:
            Settings → API.
          </p>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Project URL</Label>
            <Input
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="h-12 rounded-2xl bg-input/60"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">anon public key</Label>
            <Input
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="h-12 rounded-2xl bg-input/60"
            />
          </div>
          <Button type="submit" className="w-full h-12 rounded-2xl font-semibold bg-gradient-primary text-primary-foreground">
            Conectar
          </Button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            No projeto novo: Authentication → Providers → Email → Confirm email desligado.
            Depois rode o SQL em supabase/setup-novo-projeto.sql no SQL Editor.
          </p>
        </form>
      </div>
    </div>
  );
}
