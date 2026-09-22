"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext(false);

export function AuthProvider({ initialAuthenticated, children }: { initialAuthenticated: boolean; children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);

  useEffect(() => {
    // Listen once across page navigations. Never expose the session in context.
    try {
      const client = createClient();
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        setAuthenticated(Boolean(session?.user));
      });
      return () => subscription.unsubscribe();
    } catch {
      // Keep the server-verified initial state if browser setup is unavailable.
    }
  }, []);

  return <AuthContext.Provider value={authenticated}>{children}</AuthContext.Provider>;
}

export function useAuthenticated() {
  return useContext(AuthContext);
}
