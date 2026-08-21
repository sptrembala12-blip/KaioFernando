import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, QrCode, LogOut, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const items = [
  { to: "/admin", label: "Pedidos", icon: Receipt, end: true },
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/mesas", label: "Mesas / QR", icon: QrCode },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    nav("/admin/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav (glass) */}
      <header className="sticky top-0 z-40 glass-strong border-b border-border/40">
        <div className="max-w-7xl mx-auto flex items-center gap-2 px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2 mr-6">
            <div className="h-8 w-8 rounded-xl bg-gradient-primary shadow-amber" />
            <span className="font-semibold text-lg tracking-tight">LoungeMalibu</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
            {items.map((it) => {
              const active = it.end ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
              const Icon = it.icon;
              return (
                <RouterNavLink
                  key={it.to}
                  to={it.to}
                  end={it.end as any}
                  className={`ios-tap flex items-center gap-2 px-4 h-10 rounded-2xl text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {it.label}
                </RouterNavLink>
              );
            })}
          </nav>
          <RouterNavLink
            to="/dono"
            className="hidden sm:flex ios-tap items-center px-3 h-10 rounded-2xl text-sm font-medium text-primary hover:bg-primary/10"
          >
            Dono
          </RouterNavLink>
          <Button variant="ghost" size="sm" onClick={logout} className="rounded-2xl">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
