#!/usr/bin/env node
/**
 * Diagnóstico profundo do login Malibu (usuário teste / teste123).
 * Uso (na pasta do app):
 *   node scripts/diagnostico-login.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const emailNovo = "teste@malibu.app";
const emailVelho = "teste@malibu.local";
const password = "teste123";

function log(level, msg, data) {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${level}] ${msg}`);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
}

async function req(path, body) {
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json };
}

function mascarar(s) {
  if (!s) return "(vazio)";
  return `${s.slice(0, 12)}…(${s.length} chars)`;
}

async function tentar(email) {
  log("INFO", `--- email ${email} ---`);
  const signin = await req("/auth/v1/token?grant_type=password", { email, password });
  log(signin.status === 200 ? "OK" : "ERRO", "signIn", {
    http: signin.status,
    error: signin.json.error || signin.json.error_description || signin.json.msg || signin.json.message,
    code: signin.json.error_code || signin.json.code,
    has_token: Boolean(signin.json.access_token),
  });
  if (signin.status === 200) return { email, ok: true, via: "signIn" };

  const signup = await req("/auth/v1/signup", {
    email,
    password,
    data: { display_name: "teste" },
  });
  log(signup.status < 300 ? "OK" : "ERRO", "signUp", {
    http: signup.status,
    error: signup.json.error_description || signup.json.msg || signup.json.message || signup.json.error,
    user: signup.json.user?.id || signup.json.id,
    confirmed_at: signup.json.user?.email_confirmed_at || signup.json.email_confirmed_at,
    identities: signup.json.user?.identities?.length,
    has_token: Boolean(signup.json.access_token || signup.json.session?.access_token),
  });

  const signin2 = await req("/auth/v1/token?grant_type=password", { email, password });
  log(signin2.status === 200 ? "OK" : "ERRO", "signIn após signup", {
    http: signin2.status,
    error: signin2.json.error_description || signin2.json.msg || signin2.json.message || signin2.json.error,
    code: signin2.json.error_code || signin2.json.code,
    has_token: Boolean(signin2.json.access_token),
  });

  const msg = String(
    signin2.json.error_description || signin2.json.msg || signin.json.error_description || "",
  ).toLowerCase();

  let causa = "não identificada";
  if (msg.includes("email not confirmed")) {
    causa =
      "CONFIRM EMAIL LIGADO. A conta existe mas o e-mail interno nunca é confirmado. No dashboard Supabase: Authentication → Providers → Email → desligar Confirm email.";
  } else if (msg.includes("invalid login")) {
    causa =
      "Invalid login credentials: usuário inexistente OU conta pendente de confirmação (o Supabase esconde os dois no mesmo erro).";
  } else if (!url || !key) {
    causa = "VITE_SUPABASE_URL ou KEY ausente no .env";
  }
  log("DIAG", causa);
  return { email, ok: signin2.status === 200, causa, signin, signup, signin2 };
}

async function main() {
  log("INFO", "Supabase URL", url);
  log("INFO", "Anon key", mascarar(key));
  if (!url || !key) {
    log("ERRO", "Falta .env com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");
    process.exit(1);
  }
  try {
    const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
    log("INFO", "auth health", { http: health.status, body: await health.text() });
  } catch (e) {
    log("ERRO", "não alcançou o Supabase", String(e));
    log("DIAG", "Rede bloqueada até *.supabase.co neste ambiente. Rode o script na sua máquina.");
    process.exit(2);
  }

  const a = await tentar(emailNovo);
  const b = await tentar(emailVelho);
  console.log("\n==== RESUMO ====");
  console.log(JSON.stringify({ novo: a, velho: { email: b.email, ok: b.ok, causa: b.causa } }, null, 2));
}

main().catch((e) => {
  log("ERRO", "script quebrou", String(e));
  process.exit(1);
});
