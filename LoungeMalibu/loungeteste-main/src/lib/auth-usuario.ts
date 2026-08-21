const DOMINIO = "malibu.local";

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

export async function entrarComUsuario(
  supabase: { auth: { signInWithPassword: Function; signUp: Function } },
  usuario: string,
  password: string,
) {
  const email = usuarioParaEmail(usuario);
  const login = await supabase.auth.signInWithPassword({ email, password });
  if (!login.error) return login;

  const ehTeste =
    normalizarUsuario(usuario) === USER_TESTE && password === SENHA_TESTE;
  if (!ehTeste) return login;

  const created = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: USER_TESTE } },
  });
  if (created.error && !/already|registered|exists/i.test(created.error.message ?? "")) {
    return created;
  }
  return supabase.auth.signInWithPassword({ email, password });
}
