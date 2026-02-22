import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";
import CouchListings from "./components/CouchListings";
import CouchDetail from "./components/CouchDetail";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import RenterDashboard from "./pages/RenterDashboard";
import ProfileSettings from "./pages/ProfileSettings";
import Wishlist from "./pages/Wishlist";
import HostRequests from "./pages/HostRequests";
import NotesDemo from "./pages/NotesDemo";
import MessageCenter from "./pages/MessageCenter";
import BookingCenter from "./pages/BookingCenter";
import LegacyDataSync from "./components/LegacyDataSync";
import { AuthProvider } from "@/hooks/auth-provider";
import { SessionProvider } from "@/hooks/session-provider";
import ProtectedRoute from "@/components/ProtectedRoute";
import GlobalNav from "@/components/GlobalNav";
import VerificationReminder from "@/components/VerificationReminder";

const queryClient = new QueryClient();

const AUTH_CALLBACK_PARAMS = [
  "code",
  "token_hash",
  "access_token",
  "refresh_token",
  "type",
  "error",
  "error_code",
  "error_description",
] as const;

const hasAuthCallback = (search: string, hash: string) => {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return AUTH_CALLBACK_PARAMS.some((key) => searchParams.has(key) || hashParams.has(key));
};

const AuthCallbackRedirector = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/auth") {
      return;
    }

    if (!hasAuthCallback(location.search, location.hash)) {
      return;
    }

    navigate(`/auth${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionProvider>
      <AuthProvider>
        <LegacyDataSync />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <VerificationReminder />
          <BrowserRouter>
            <AuthCallbackRedirector />
            <GlobalNav />
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
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
            <Route path="/renter-dashboard" element={
              <ProtectedRoute>
                <RenterDashboard />
              </ProtectedRoute>
            } />
            <Route path="/host-requests" element={
              <ProtectedRoute>
                <HostRequests />
              </ProtectedRoute>
            } />
            <Route path="/wishlist" element={
              <ProtectedRoute>
                <Wishlist />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfileSettings />
              </ProtectedRoute>
            } />
            <Route path="/notes" element={
              <ProtectedRoute>
                <NotesDemo />
              </ProtectedRoute>
            } />
            <Route path="/messages" element={
              <ProtectedRoute>
                <MessageCenter />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <BookingCenter />
              </ProtectedRoute>
            } />
            <Route path="/bookings" element={
              <ProtectedRoute>
                <BookingCenter />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </SessionProvider>
  </QueryClientProvider>
);

export default App;
