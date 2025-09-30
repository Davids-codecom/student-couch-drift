import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";
import CouchListings from "./components/CouchListings";
import CouchDetail from "./components/CouchDetail";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import HostOnboarding from "./pages/HostOnboarding";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/host-onboarding" element={
              <ProtectedRoute>
                <HostOnboarding />
              </ProtectedRoute>
            } />
            <Route path="/listings" element={
              <ProtectedRoute>
                <CouchListings />
              </ProtectedRoute>
            } />
            <Route path="/couch/:id" element={
              <ProtectedRoute>
                <CouchDetail />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
