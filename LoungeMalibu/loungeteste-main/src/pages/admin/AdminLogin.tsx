import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function AdminLogin() {
  const nav = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) nav("/admin", { replace: true });
  }, [user, isAdmin, loading, nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Conta criada!", { description: "Você já pode acessar o painel." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta 🥃");
      }
    } catch (err: any) {
      toast.error("Falha", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-glow">
      <div className="w-full max-w-md glass-card p-8 space-y-6 animate-slide-up">
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-3xl bg-gradient-primary shadow-amber animate-glow-pulse" />
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Lounge<span className="text-gradient-amber">OS</span></h1>
            <p className="text-sm text-muted-foreground">Painel administrativo</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-2xl bg-input/60 border-border/60"
              placeholder="dono@bar.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-2xl bg-input/60 border-border/60"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-2xl text-base font-semibold bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-amber ios-tap"
          >
            {submitting ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "login" ? "Primeiro acesso? Criar conta de admin" : "Já tem conta? Entrar"}
        </button>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          O primeiro usuário cadastrado vira <span className="text-primary font-medium">admin</span> automaticamente.
        </p>
      </div>
    </div>
  );
}
