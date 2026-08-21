import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminPedidos from "./pages/admin/AdminPedidos";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProdutos from "./pages/admin/AdminProdutos";
import AdminMesas from "./pages/admin/AdminMesas";
import DonoApp from "./pages/dono/DonoApp";
import DonoLogin from "./pages/dono/DonoLogin";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminProtectedRoute><AdminPedidos /></AdminProtectedRoute>} />
          <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
          <Route path="/admin/produtos" element={<AdminProtectedRoute><AdminProdutos /></AdminProtectedRoute>} />
          <Route path="/admin/mesas" element={<AdminProtectedRoute><AdminMesas /></AdminProtectedRoute>} />
          <Route path="/dono/login" element={<DonoLogin />} />
          <Route path="/dono" element={<AdminProtectedRoute loginPath="/dono/login"><DonoApp /></AdminProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
