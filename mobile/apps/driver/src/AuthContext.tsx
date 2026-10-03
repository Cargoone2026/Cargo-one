/**
 * CargoOne Driver — AuthContext.
 *
 * Mirrors the web AuthContext (frontend/src/context/AuthContext.jsx)
 * with two mobile-specific differences:
 *   1. Bearer token via AsyncStorage (via @cargoone/core) — no cookies.
 *   2. Login gate is by driver role; wrong-role sign-in is refused and
 *      the token is cleared so the user is bounced back to Login.
 *
 * State shape (deliberately identical to web):
 *   { user, loading, login(email, password), logout(), refresh() }
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  login as coreLogin,
  logout as coreLogout,
  me as coreMe,
  saveToken,
  ApiError,
  type User,
} from "@cargoone/core";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // 6-second cold-start fuse. Mirrors Customer's AuthContext hydration
    // guard: fetch has no default timeout on React Native, so a stalled
    // DNS/TLS during cold start could otherwise leave `loading: true`
    // forever and the DriverLoadingScreen would never dismiss. On fuse
    // we treat the user as unauthenticated (null) and let the app render
    // the Login stack.
    const timed = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 6000),
    );
    const me = (await Promise.race([
      coreMe().catch(() => null),
      timed,
    ])) as User | null;
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await coreLogin(email, password);
    // Enforce driver-only sign-in on the Driver app. Other roles can
    // exist on the same backend (customer, admin) but must use their
    // own app. Clear the token so we never leave a wrong-role session.
    if (res.user?.role !== "driver") {
      await saveToken(null);
      throw new ApiError(
        "This is the Driver app. Please use the CargoOne Customer app or the web portal to sign in.",
        403,
      );
    }
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await coreLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
