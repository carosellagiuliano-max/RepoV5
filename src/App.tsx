import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { SessionGuard } from "@/components/auth/SessionGuard";
import Index from "./pages/Index";
import Services from "./pages/Services";
import Gallery from "./pages/Gallery";
import AboutContact from "./pages/AboutContact";
import Admin from "./pages/Admin";
import CustomerDashboard from "./pages/CustomerDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/leistungen" element={<Services />} />
            <Route path="/galerie" element={<Gallery />} />
            <Route path="/ueber-uns" element={<AboutContact />} />
            <Route 
              path="/admin" 
              element={
                <SessionGuard requireAdmin>
                  <Admin />
                </SessionGuard>
              } 
            />
            <Route 
              path="/kunden-dashboard" 
              element={
                <SessionGuard requireCustomer>
                  <CustomerDashboard />
                </SessionGuard>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
