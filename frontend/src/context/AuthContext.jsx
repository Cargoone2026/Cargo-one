import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";

/**
 * Cookie-based auth. The backend sets an HttpOnly, Secure, SameSite=Lax
 * cookie called `cargoone_session` on /auth/login and /auth/register.
 * The frontend NEVER stores the JWT in localStorage or IndexedDB. Session
 * restoration on page load is performed by asking the backend who we are
 * via GET /auth/me (which succeeds when the cookie is still valid).
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api("/auth/me");
      setUser(me);
      return me;
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        setUser(null);
        return null;
      }
      throw e;
    }
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

  const login = useCallback(
    async (email, password) => {
      await api("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      // Backend already set the session cookie in the response. Now fetch /me.
      const me = await refresh();
      return me;
    },
    [refresh],
  );

  const register = useCallback(
    async (payload) => {
      // Pass through any fields the caller provides (email/password/name/phone/
      // role + optional address_line1/2, town, county, postcode, country).
      await api("/auth/register", { method: "POST", body: payload });
      const me = await refresh();
      return me;
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // idempotent — swallow errors so the UI can still reset
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth used outside AuthProvider");
  return ctx;
}
