import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * useCatalog — web port of the Expo `src/hooks/useCatalog.ts` hooks.
 *
 * Fetches service categories / vehicles / capabilities once per session
 * and caches in module memory for 5 minutes. Preserves the same TTL and
 * cache shape as the original app.
 */
const TTL_MS = 5 * 60 * 1000;
let _catCache = null;
let _vehCache = null;
let _capCache = null;

function fresh(cache) {
  return cache && Date.now() - cache.at < TTL_MS ? cache.data : null;
}

export function useCategories() {
  const [data, setData] = useState(fresh(_catCache) || []);
  const [loading, setLoading] = useState(!fresh(_catCache));
  useEffect(() => {
    if (fresh(_catCache)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api("/catalog/categories");
        const list = Array.isArray(res) ? res : res?.items || [];
        _catCache = { data: list, at: Date.now() };
        if (!cancelled) setData(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, loading };
}

export function useVehicles() {
  const [data, setData] = useState(fresh(_vehCache) || []);
  const [loading, setLoading] = useState(!fresh(_vehCache));
  useEffect(() => {
    if (fresh(_vehCache)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api("/catalog/vehicles");
        const list = Array.isArray(res) ? res : res?.items || [];
        _vehCache = { data: list, at: Date.now() };
        if (!cancelled) setData(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, loading };
}

export function useCapabilities() {
  const [data, setData] = useState(fresh(_capCache) || []);
  const [loading, setLoading] = useState(!fresh(_capCache));
  useEffect(() => {
    if (fresh(_capCache)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api("/catalog/capabilities");
        const list = Array.isArray(res) ? res : res?.items || [];
        _capCache = { data: list, at: Date.now() };
        if (!cancelled) setData(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, loading };
}

export async function requestRecommendation(payload) {
  return api("/catalog/recommend-vehicle", { method: "POST", body: payload });
}
