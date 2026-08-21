import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const LS_URL = "malibu.supabase.url";
const LS_KEY = "malibu.supabase.key";

export function getSupabaseConfig() {
  const lsUrl = typeof window !== "undefined" ? localStorage.getItem(LS_URL) : null;
  const lsKey = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
  const url = (lsUrl || import.meta.env.VITE_SUPABASE_URL || "").trim();
  const key = (lsKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  return { url, key };
}

export function hasSupabaseConfig() {
  const { url, key } = getSupabaseConfig();
  return url.startsWith("https://") && key.length > 20;
}

export function setSupabaseConfig(url: string, key: string) {
  localStorage.setItem(LS_URL, url.trim());
  localStorage.setItem(LS_KEY, key.trim());
  cached = null;
}

export function clearSupabaseConfig() {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem("sb-" + (getSupabaseConfig().url.split("//")[1]?.split(".")[0] || "") + "-auth-token");
  cached = null;
}

let cached: SupabaseClient<Database> | null = null;
let cachedSig = "";

export function getSupabase() {
  const { url, key } = getSupabaseConfig();
  const sig = `${url}::${key}`;
  if (!url || !key) {
    throw new Error("Supabase não configurado");
  }
  if (!cached || cachedSig !== sig) {
    cached = createClient<Database>(url, key, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    cachedSig = sig;
  }
  return cached;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, _receiver) {
    const client = getSupabase() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});
