import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { USER_TESTE, SENHA_TESTE, SQL_CONFIRMAR_TESTE, entrarComUsuario, validarUsuario, traduzirErroAuth } from "@/lib/auth-usuario";
import { AuthDebugPanel } from "@/components/AuthDebugPanel";
import { authLog } from "@/lib/auth-log";

export default function DonoLogin() {
  const nav = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [usuario, setUsuario] = useState(USER_TESTE);
  const [password, setPassword] = useState(SENHA_TESTE);
  const [submitting, setSubmitting] = useState(false);
  const [precisaSql, setPrecisaSql] = useState(false);

  useEffect(() => {
    authLog("info", "useAuth", { loading, temUser: !!user, isAdmin });
    if (!loading && user && isAdmin) nav("/dono", { replace: true });
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
    try {
      const { error } = await entrarComUsuario(supabase, usuario, password);
      if (error) throw error;
      authLog("ok", "login sem error — aguardando isAdmin");
    } catch (err: any) {
      const diag = traduzirErroAuth(err);
      authLog("erro", diag.titulo, { detalhe: diag.detalhe, causa: diag.causa });
      toast.error(diag.titulo);
      if (/email_not_confirmed|not confirmed/i.test(String(err?.code ?? "") + String(err?.message ?? ""))) {
        setPrecisaSql(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-gradient-glow">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <img src="/favicon.png" alt="" className="h-16 w-16 rounded-2xl shadow-amber mb-5" />
          <h1 className="text-[13px] tracking-[0.35em] uppercase text-primary/90 font-medium">Malibu</h1>
          <p className="mt-2 text-2xl font-semibold tracking-tight">Caixa</p>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-2xl bg-input/60 border-border/50"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-2xl font-semibold bg-gradient-primary text-primary-foreground shadow-amber"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        {precisaSql && (
          <div className="mt-4 glass-card p-4 space-y-2 text-left">
            <p className="text-xs text-muted-foreground">Conta criada. Confirme no SQL Editor do Supabase e entre de novo:</p>
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all text-primary/90">{SQL_CONFIRMAR_TESTE}</pre>
          </div>
        )}
        <AuthDebugPanel />
        <button
          type="button"
          className="w-full mt-4 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => {
            localStorage.removeItem("malibu.supabase.url");
            localStorage.removeItem("malibu.supabase.key");
            window.location.reload();
          }}
        >
          Trocar projeto Supabase
        </button>
      </div>
    </div>
  );
}
