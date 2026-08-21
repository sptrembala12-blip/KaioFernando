import { authLog, dumpAuthError } from "@/lib/auth-log";

const DOMINIO = "malibu.app";

export const USER_TESTE = "teste";
export const SENHA_TESTE = "teste123";

export function normalizarUsuario(usuario: string) {
  return usuario.trim().toLowerCase();
}

export function validarUsuario(usuario: string) {
  const u = normalizarUsuario(usuario);
  if (u.length < 3) return "Usuário muito curto.";
  if (u.includes("@")) return "Use só o usuário, sem e-mail.";
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) return "Use letras, números, ponto ou underline.";
  return null;
}

export function usuarioParaEmail(usuario: string) {
  return `${normalizarUsuario(usuario)}@${DOMINIO}`;
}

export function traduzirErroAuth(err: any): { titulo: string; detalhe: string; causa: string } {
  const msg = String(err?.message ?? err ?? "");
  const code = String(err?.code ?? "");
  const blob = `${code} ${msg}`.toLowerCase();

  if (/email not confirmed|email_not_confirmed/.test(blob)) {
    return {
      titulo: "E-mail interno não confirmado",
      detalhe: msg,
      causa:
        "O Supabase está exigindo confirmação de e-mail. O usuário teste usa e-mail interno e nunca chega inbox. Desative Confirm email em Authentication > Providers > Email.",
    };
  }
  if (/invalid login|invalid_credentials|invalid login credentials/.test(blob)) {
    return {
      titulo: "Credenciais recusadas",
      detalhe: msg,
      causa:
        "Usuário não existe, senha errada, ou a conta foi criada e ficou pendente de confirmação (o Supabase responde a mesma mensagem).",
    };
  }
  if (/already|registered|exists/.test(blob)) {
    return {
      titulo: "Usuário já existe",
      detalhe: msg,
      causa: "Conta criada antes, mas o login falhou — quase sempre e-mail não confirmado.",
    };
  }
  if (/failed to fetch|network|load failed|err_name/.test(blob)) {
    return {
      titulo: "Sem conexão com o Supabase",
      detalhe: msg,
      causa: "URL/chave inválida ou rede bloqueando *.supabase.co.",
    };
  }
  return { titulo: "Falha no login", detalhe: msg || "erro desconhecido", causa: "Ver logs abaixo." };
}

export async function entrarComUsuario(
  supabase: { auth: { signInWithPassword: Function; signUp: Function } },
  usuario: string,
  password: string,
) {
  const email = usuarioParaEmail(usuario);
  authLog("info", "início login", { usuario: normalizarUsuario(usuario), email, senhaLen: password.length });

  authLog("info", "1) signInWithPassword");
  const login = await supabase.auth.signInWithPassword({ email, password });
  authLog(login.error ? "warn" : "ok", "1) resultado signIn", {
    error: dumpAuthError(login.error),
    session: !!login.data?.session,
    userId: login.data?.user?.id,
    confirmed: login.data?.user?.email_confirmed_at,
  });
  if (!login.error && login.data?.session) return login;

  const ehTeste = normalizarUsuario(usuario) === USER_TESTE && password === SENHA_TESTE;
  authLog("info", "é usuário teste?", ehTeste);
  if (!ehTeste) return login;

  authLog("info", "2) signUp automático do teste");
  const created = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: USER_TESTE } },
  });
  authLog(created.error ? "warn" : "ok", "2) resultado signUp", {
    error: dumpAuthError(created.error),
    session: !!created.data?.session,
    userId: created.data?.user?.id,
    identities: created.data?.user?.identities?.length,
    confirmed: created.data?.user?.email_confirmed_at,
  });

  if (created.data?.session) {
    authLog("ok", "signup já devolveu sessão (confirm email desligado)");
    return created;
  }

  if (created.error && !/already|registered|exists/i.test(created.error.message ?? "")) {
    return created;
  }

  authLog("info", "3) signIn de novo após signup");
  const login2 = await supabase.auth.signInWithPassword({ email, password });
  authLog(login2.error ? "erro" : "ok", "3) resultado signIn #2", {
    error: dumpAuthError(login2.error),
    session: !!login2.data?.session,
    userId: login2.data?.user?.id,
    confirmed: login2.data?.user?.email_confirmed_at,
  });

  if (login2.error) {
    const diag = traduzirErroAuth(login2.error);
    authLog("erro", `DIAGNÓSTICO: ${diag.causa}`);
  }
  return login2;
}
