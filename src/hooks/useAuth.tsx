import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "user" | "admin" | "staff";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TIMEOUT_MS = 12_000;

const useAuthState = (): AuthContextValue => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const finishLoading = () => mounted && setLoading(false);
    const timeout = window.setTimeout(() => {
      if (!mounted) return;
      console.warn("Authentication restoration timed out; continuing signed out.");
      setUser(null);
      setSession(null);
      setRole(null);
      setLoading(false);
    }, AUTH_TIMEOUT_MS);

    // A signed-in account always resolves to at least "user"; never leave the
    // role null, or role-gated routes would spin forever.
    const loadRole = async (userId: string) => {
      try {
        const { data, error } = await supabase.rpc("get_user_role", { _user_id: userId });
        if (error) throw error;
        if (mounted) setRole((data as UserRole | null) ?? "user");
      } catch (error) {
        if (import.meta.env.DEV) console.error("Unable to load user role", error);
        if (mounted) setRole(null);
      } finally {
        window.clearTimeout(timeout);
        finishLoading();
      }
    };
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role after state update
          void loadRole(session.user.id);
        } else {
          window.clearTimeout(timeout);
          setRole(null);
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) void loadRole(session.user.id);
        else {
          window.clearTimeout(timeout);
          setRole(null);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (import.meta.env.DEV) console.error("Unable to restore session", error);
        window.clearTimeout(timeout);
        finishLoading();
      });

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return { user, session, role, loading, signOut };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const value = useAuthState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
