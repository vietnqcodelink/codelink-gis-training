import type { LayerId } from "./types";

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
export const MAP_CENTER: [number, number] = [106.660172, 10.762622]; // Ho Chi Minh City
export const WARDS_FILL_LAYER = "hcm-wards-fill";
export const ROAD_WARDS_SOURCE = "hcm-road-wards";
export const MBTILES_TILE_URL = import.meta.env.VITE_MBTILES_TILE_URL ?? "/data/hcm-road-wards/{z}/{x}/{y}.pbf";

export const LAYERS: Array<{ id: LayerId; label: string; color: string; mapLayerIds: string[] }> = [
  { id: "roads", label: "Road network", color: "#dc2626", mapLayerIds: ["roads-line"] },
  { id: "hcm", label: "HCM boundary", color: "#0f766e", mapLayerIds: ["hcm-fill", "hcm-outline"] },
  { id: "wards", label: "Wards", color: "#f59e0b", mapLayerIds: ["hcm-wards-fill", "hcm-wards-outline"] },
];
