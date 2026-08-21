import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { USER_TESTE, SENHA_TESTE, entrarComUsuario, usuarioParaEmail, validarUsuario, traduzirErroAuth } from "@/lib/auth-usuario";
import { AuthDebugPanel } from "@/components/AuthDebugPanel";
import { authLog } from "@/lib/auth-log";

export default function AdminLogin() {
  const nav = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [usuario, setUsuario] = useState(USER_TESTE);
  const [password, setPassword] = useState(SENHA_TESTE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authLog("info", "useAuth admin", { loading, temUser: !!user, isAdmin });
    if (!loading && user && isAdmin) nav("/admin", { replace: true });
    if (!loading && user && !isAdmin) {
      authLog("erro", "entrou no Auth mas não é admin — user_roles sem role admin");
    }
  }, [user, isAdmin, loading, nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const erro = validarUsuario(usuario);
    if (erro) {
      toast.error(erro);
      return;
    }
    setSubmitting(true);
    const email = usuarioParaEmail(usuario);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: usuario.trim() },
            emailRedirectTo: `${window.location.origin}/admin`,
          },
        });
        if (error) throw error;
        toast.success("Acesso criado.");
        authLog("ok", "signup admin ok");
      } else {
        const { error } = await entrarComUsuario(supabase, usuario, password);
        if (error) throw error;
        authLog("ok", "login admin sem error — aguardando isAdmin");
      }
    } catch (err: any) {
      const diag = traduzirErroAuth(err);
      authLog("erro", diag.titulo, { detalhe: diag.detalhe, causa: diag.causa, raw: err?.message });
      toast.error(diag.titulo, { description: diag.causa });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-gradient-glow">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <img src="/favicon.png" alt="" className="h-16 w-16 rounded-2xl shadow-amber mb-5" />
          <h1 className="text-[13px] tracking-[0.22em] uppercase text-primary/90 font-medium">LoungeMalibu</h1>
          <p className="mt-2 text-2xl font-semibold tracking-tight">Operação</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Usuário</Label>
            <Input
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="h-12 rounded-2xl bg-input/60 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Senha</Label>
            <Input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-2xl bg-input/60 border-border/50"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-2xl font-semibold bg-gradient-primary text-primary-foreground shadow-amber ios-tap"
          >
            {submitting ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar acesso"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="w-full mt-5 text-xs tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "login" ? "Criar acesso" : "Já tenho acesso"}
        </button>
        <AuthDebugPanel />
      </div>
    </div>
  );
}
