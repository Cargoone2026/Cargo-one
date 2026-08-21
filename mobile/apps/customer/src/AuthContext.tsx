import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SharedAPI, User, login as apiLogin, logout as apiLogout, register as apiRegister, RegisterInput } from "@cargoone/core";

export interface AuthState {
  user: User | null;
  hydrated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside AuthContext");
  return v;
}

/**
 * Session hook shared by the whole customer app. On mount it hydrates
 * `user` from `/api/auth/me` using the token that was persisted by any
 * previous session (see `@cargoone/core` `saveToken`).
 */
export function useAuthValue(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    // Guard against pathological network hangs during cold start —
    // fetch has no default timeout on RN, so `SharedAPI.me()` could
    // sit forever if DNS/TLS stalls in the simulator. We race the
    // real request against a 6-second fuse; on fuse we simply keep
    // `user = null` (unauthenticated) and let the app render Login.
    const timed = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    const me = await Promise.race([SharedAPI.me().catch(() => null), timed]);
    setUser(me && (me as User).role === "customer" ? (me as User) : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        // ALWAYS resolve hydration — even if refresh throws before
        // its own catch reaches. Without this, any unhandled error
        // would leave `hydrated=false` forever and the LoadingScreen
        // splash would never dismiss.
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      if (res.user.role !== "customer") {
        await apiLogout();
        throw new Error("This app is for customers. Please use the driver app.");
      }
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setLoading(true);
    try {
      const res = await apiRegister({ ...input, role: "customer" });
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return useMemo(
    () => ({ user, hydrated, loading, login, register, logout, refresh }),
    [user, hydrated, loading, login, register, logout, refresh],
  );
}
