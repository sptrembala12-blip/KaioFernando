import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function DonoLogin() {
  const nav = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) nav("/dono", { replace: true });
  }, [user, isAdmin, loading, nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo");
    } catch (err: any) {
      toast.error("Falha", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-gradient-glow">
      <div className="w-full max-w-md glass-card p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">PWA do dono</div>
          <h1 className="text-3xl font-bold tracking-tight">
            Lounge<span className="text-gradient-amber">OS</span>
          </h1>
          <p className="text-sm text-muted-foreground">Só o dono. Venda aprovada após confirmar o pagamento.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-2xl bg-input/60"
              placeholder="dono@lounge.com"
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
              className="h-12 rounded-2xl bg-input/60"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-2xl font-semibold bg-gradient-primary text-primary-foreground shadow-amber"
          >
            {submitting ? "..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
