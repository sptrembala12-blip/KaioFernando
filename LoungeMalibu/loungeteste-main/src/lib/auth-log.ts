export type AuthLogLevel = "info" | "ok" | "warn" | "erro";

export interface AuthLogLinha {
  t: string;
  level: AuthLogLevel;
  msg: string;
  data?: unknown;
}

const linhas: AuthLogLinha[] = [];
const ouvintes = new Set<(l: AuthLogLinha[]) => void>();

function agora() {
  return new Date().toISOString().slice(11, 23);
}

export function authLog(level: AuthLogLevel, msg: string, data?: unknown) {
  const linha: AuthLogLinha = { t: agora(), level, msg, data };
  linhas.push(linha);
  if (linhas.length > 80) linhas.shift();
  const payload = data !== undefined ? data : "";
  const fn = level === "erro" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[auth ${linha.t}] ${msg}`, payload);
  ouvintes.forEach((fnOuv) => fnOuv([...linhas]));
}

export function authLogs() {
  return [...linhas];
}

export function onAuthLogs(fn: (l: AuthLogLinha[]) => void) {
  ouvintes.add(fn);
  fn([...linhas]);
  return () => {
    ouvintes.delete(fn);
  };
}

export function dumpAuthError(err: any) {
  if (!err) return null;
  return {
    name: err.name,
    message: err.message,
    status: err.status,
    code: err.code,
    name2: err.__isAuthError,
  };
}
