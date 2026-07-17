/**
 * Shared hooks for Cargo One's service categories & vehicle types.
 * Fetches once per app session, cached in module memory.
 */
import { useEffect, useState } from "react";

import { api } from "@/src/api/client";

export type ServiceCategory = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  active: boolean;
  featured?: boolean;
  default_vehicles: string[];
  typical_weight_kg?: number | null;
  typical_volume_m3?: number | null;
};

export type VehicleType = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  active: boolean;
  featured?: boolean;
  max_weight_kg: number;
  max_volume_m3: number | null;
  features: string[];
  capabilities?: string[];
};

export type VehicleCapability = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  active: boolean;
  featured?: boolean;
};

export type RecommendedVehicle = VehicleType & {
  recommendation_label: string;
  is_best_match: boolean;
  reason?: string;
};

// Simple in-memory cache — refresh once per session
let _categoriesCache: { data: ServiceCategory[]; at: number } | null = null;
let _vehiclesCache: { data: VehicleType[]; at: number } | null = null;
let _capabilitiesCache: { data: VehicleCapability[]; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchCategories(): Promise<ServiceCategory[]> {
  if (_categoriesCache && Date.now() - _categoriesCache.at < TTL_MS) {
    return _categoriesCache.data;
  }
  const data = await api<ServiceCategory[]>("/catalog/categories", { auth: false });
  _categoriesCache = { data, at: Date.now() };
  return data;
}

async function fetchVehicles(): Promise<VehicleType[]> {
  if (_vehiclesCache && Date.now() - _vehiclesCache.at < TTL_MS) {
    return _vehiclesCache.data;
  }
  const data = await api<VehicleType[]>("/catalog/vehicles", { auth: false });
  _vehiclesCache = { data, at: Date.now() };
  return data;
}

async function fetchCapabilities(): Promise<VehicleCapability[]> {
  if (_capabilitiesCache && Date.now() - _capabilitiesCache.at < TTL_MS) {
    return _capabilitiesCache.data;
  }
  const data = await api<VehicleCapability[]>("/catalog/capabilities", { auth: false });
  _capabilitiesCache = { data, at: Date.now() };
  return data;
}

export function invalidateCatalog(): void {
  _categoriesCache = null;
  _vehiclesCache = null;
  _capabilitiesCache = null;
}

export function useCategories() {
  const [data, setData] = useState<ServiceCategory[]>(_categoriesCache?.data || []);
  const [loading, setLoading] = useState(!_categoriesCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCategories()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(String(e?.message || e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}

export function useVehicles() {
  const [data, setData] = useState<VehicleType[]>(_vehiclesCache?.data || []);
  const [loading, setLoading] = useState(!_vehiclesCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchVehicles()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(String(e?.message || e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}

export function useCapabilities() {
  const [data, setData] = useState<VehicleCapability[]>(_capabilitiesCache?.data || []);
  const [loading, setLoading] = useState(!_capabilitiesCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCapabilities()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(String(e?.message || e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error };
}

export type RecommendPayload = {
  category_key: string;
  weight_kg?: number | null;
  volume_m3?: number | null;
  dimensions_l_m?: number | null;
  dimensions_w_m?: number | null;
  dimensions_h_m?: number | null;
  item_count?: number | null;
  needs_forklift?: boolean;
  needs_loading_help?: boolean;
  required_capabilities?: string[];
  distance_miles?: number | null;
};

export async function requestRecommendation(payload: RecommendPayload): Promise<{
  category: ServiceCategory;
  computed_volume_m3: number | null;
  recommendations: RecommendedVehicle[];
}> {
  return api("/catalog/recommend-vehicle", { method: "POST", body: payload, auth: false });
}
