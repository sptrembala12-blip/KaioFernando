import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function AdminProtectedRoute({
  children,
  loginPath = "/admin/login",
}: {
  children: React.ReactNode;
  loginPath?: string;
}) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="glass-card p-8">
          <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-primary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to={loginPath} replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="glass-card p-8 max-w-md text-center space-y-3">
          <h2 className="text-2xl font-bold">Acesso negado</h2>
          <p className="text-muted-foreground">Sua conta não tem permissão de administrador.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
