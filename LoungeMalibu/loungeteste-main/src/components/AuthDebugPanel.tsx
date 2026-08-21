import { useEffect, useState } from "react";
import { AuthLogLinha, onAuthLogs } from "@/lib/auth-log";

const cor: Record<AuthLogLinha["level"], string> = {
  info: "text-muted-foreground",
  ok: "text-emerald-400",
  warn: "text-amber-400",
  erro: "text-red-400",
};

export function AuthDebugPanel() {
  const [linhas, setLinhas] = useState<AuthLogLinha[]>([]);
  useEffect(() => onAuthLogs(setLinhas), []);
  if (!linhas.length) return null;
  return (
    <pre className="mt-6 max-h-56 overflow-auto rounded-xl bg-black/50 p-3 text-[10px] leading-relaxed font-mono text-left border border-white/10">
      {linhas.map((l, i) => (
        <div key={i} className={cor[l.level]}>
          {l.t} {l.level.toUpperCase()} {l.msg}
          {l.data !== undefined ? ` ${JSON.stringify(l.data)}` : ""}
        </div>
      ))}
    </pre>
  );
}
