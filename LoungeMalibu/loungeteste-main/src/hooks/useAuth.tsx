import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authLog } from "@/lib/auth-log";

export type Role = "admin" | "garcom" | "cliente";

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      authLog("info", `onAuthStateChange ${event}`, { userId: sess?.user?.id ?? null });
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => checkAdmin(sess.user.id), 0);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await checkAdmin(s.user.id);
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function checkAdmin(uid: string) {
    authLog("info", "checkAdmin", { uid });
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    authLog(error ? "erro" : "ok", "checkAdmin resultado", {
      isAdmin: !!data,
      error: error?.message,
      data,
    });
    setIsAdmin(!!data);
    setLoading(false);
  }

  return { user, session, isAdmin, loading };
}
