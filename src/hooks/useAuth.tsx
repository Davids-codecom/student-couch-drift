import { createContext, useContext, useEffect, useState } from "react";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  user_role: 'host' | 'renter';
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

interface AuthContextType {
  user: Profile | null;
  session: any;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for user data
    const checkUser = () => {
      try {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
          const parsed = JSON.parse(userData);
          setUser(parsed);
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('currentUser');
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const signOut = async () => {
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  const value = {
    user,
    session: user ? { user } : null,
    profile: user,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};