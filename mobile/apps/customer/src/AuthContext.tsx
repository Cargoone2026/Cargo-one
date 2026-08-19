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
    const me = await SharedAPI.me().catch(() => null);
    setUser(me && me.role === "customer" ? me : null);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setHydrated(true);
    })();
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
