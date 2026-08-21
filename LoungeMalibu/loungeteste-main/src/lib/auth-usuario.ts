const DOMINIO = "malibu.local";

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
