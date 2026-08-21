import { useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Printer, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

interface Mesa {
  id: string;
  numero: number;
  hash: string;
  ativa: boolean;
}

export default function AdminMesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<Mesa | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("mesas").select("*").order("numero");
    setMesas((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function adicionar() {
    const proximo = mesas.length === 0 ? 1 : Math.max(...mesas.map((m) => m.numero)) + 1;
    const { data, error } = await supabase.from("mesas").insert({ numero: proximo }).select().single();
    if (error) return toast.error(error.message);
    toast.success(`Mesa ${proximo} criada`);
    setMesas((m) => [...m, data as any]);
    setSelecionada(data as any);
  }

  function urlMesa(m: Mesa) {
    return `${window.location.origin}/?mesa=${m.hash}`;
  }

  function imprimir() {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w || !selecionada || !printRef.current) return;
    w.document.write(`
      <html><head><title>QR Mesa ${selecionada.numero}</title>
      <style>body{font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;text-align:center}h1{font-size:48px;margin:0 0 8px}p{color:#666;margin:0 0 24px;font-size:14px}</style>
      </head><body>
        <h1>Mesa ${selecionada.numero}</h1>
        <p>Aponte a câmera do celular para fazer seu pedido</p>
        ${printRef.current.innerHTML}
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
          <p className="text-sm text-muted-foreground mt-1">{mesas.length} mesa{mesas.length === 1 ? "" : "s"}</p>
        </div>
        <Button onClick={adicionar} className="rounded-2xl bg-gradient-primary text-primary-foreground shadow-amber ios-tap">
          <Plus className="h-4 w-4 mr-2" /> Nova mesa
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {loading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card h-28 animate-pulse" />)
          ) : mesas.length === 0 ? (
            <div className="col-span-full glass-card p-10 text-center text-muted-foreground">Nenhuma mesa</div>
          ) : (
            mesas.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelecionada(m)}
                className={`glass-card p-4 ios-tap text-left transition-all ${
                  selecionada?.id === m.id ? "ring-amber-glow" : "hover:bg-secondary/30"
                }`}
              >
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Mesa</div>
                <div className="text-3xl font-bold text-gradient-amber">{m.numero}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <QrCode className="h-3 w-3" /> Ver QR
                </div>
              </button>
            ))
          )}
        </div>

        <div className="glass-card p-6 sticky top-24 self-start">
          {!selecionada ? (
            <div className="text-center text-muted-foreground py-12">
              <QrCode className="h-12 w-12 mx-auto opacity-30 mb-3" />
              Selecione uma mesa para ver o QR Code
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Mesa</div>
                <div className="text-5xl font-bold text-gradient-amber">{selecionada.numero}</div>
              </div>
              <div ref={printRef} className="bg-white rounded-2xl p-6 grid place-items-center mb-4">
                <QRCodeCanvas value={urlMesa(selecionada)} size={220} level="H" includeMargin={false} />
              </div>
              <p className="text-xs text-muted-foreground text-center mb-3 break-all">{urlMesa(selecionada)}</p>
              <Button onClick={imprimir} className="w-full rounded-2xl bg-gradient-primary text-primary-foreground font-semibold ios-tap">
                <Printer className="h-4 w-4 mr-2" /> Imprimir QR
              </Button>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
