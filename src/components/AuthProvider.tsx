"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session, AuthError } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuestMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (
    email: string,
    captchaToken: string,
  ) => Promise<{ error: AuthError | null }>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setGuestFlag() {
  localStorage.setItem("kanso_guest_mode", "true");
  document.cookie =
    "kanso_guest_mode=true; path=/; max-age=31536000; SameSite=Lax";
}

function clearGuestFlag() {
  localStorage.removeItem("kanso_guest_mode");
  document.cookie = "kanso_guest_mode=; path=/; max-age=0";
}

function hasGuestFlag() {
  return localStorage.getItem("kanso_guest_mode") === "true";
}

function makeGuestUser(): User {
  return {
    id: "guest",
    email: "guest@demo.kanso",
    app_metadata: {},
    user_metadata: { display_name: "Guest User" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

export function AuthProvider({
  children,
  initialIsGuest = false,
}: {
  children: React.ReactNode;
  // Mirrors the `kanso_guest_mode` cookie, read server-side by the root
  // layout, so the first client render agrees with the SSR output instead
  // of branching on `typeof window` and diverging from it (hydration error).
  initialIsGuest?: boolean;
}) {
  const [isGuestMode, setIsGuestMode] = useState<boolean>(initialIsGuest);
  const [user, setUser] = useState<User | null>(() =>
    initialIsGuest ? makeGuestUser() : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!isGuestMode);
  const supabase = createClient();

  useEffect(() => {
    // A real session always wins — a stale guest flag must not shadow it.
    const applyRealSession = (s: Session) => {
      clearGuestFlag();
      setSession(s);
      setUser(s.user);
      setIsGuestMode(false);
    };

    const applyNoRealSession = () => {
      if (hasGuestFlag()) {
        setUser(makeGuestUser());
        setIsGuestMode(true);
      } else {
        clearGuestFlag();
        setSession(null);
        setUser(null);
        setIsGuestMode(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) applyRealSession(session);
      else applyNoRealSession();
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // getSession() above already resolved this snapshot.
      if (event === "INITIAL_SESSION") return;

      if (session) applyRealSession(session);
      else applyNoRealSession();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [supabase.auth]);

  const signInWithMagicLink = useCallback(
    async (email: string, captchaToken: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          captchaToken,
        },
      });
      return { error };
    },
    [supabase.auth],
  );

  const signInAsGuest = useCallback(() => {
    setGuestFlag();
    setUser(makeGuestUser());
    setIsGuestMode(true);
  }, []);

  const signOut = useCallback(async () => {
    if (isGuestMode) {
      clearGuestFlag();
      setUser(null);
      setIsGuestMode(false);
    } else {
      await supabase.auth.signOut();
    }
  }, [supabase.auth, isGuestMode]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isGuestMode,
        signInWithGoogle,
        signInWithMagicLink,
        signInAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
