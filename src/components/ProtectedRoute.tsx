import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, authError } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 px-4 text-center">
        <div className="max-w-md space-y-3 rounded-3xl border border-white/50 bg-white/90 p-6 shadow-lg">
          <p className="text-lg font-semibold text-slate-900">Unable to reach Supabase</p>
          <p className="text-sm text-muted-foreground">
            {authError}
            <br />
            Check that <code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> are set
            in your <code>.env</code> file or that the Supabase service is reachable, then refresh the page.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
