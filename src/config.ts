export const MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";
export const MAP_CENTER: [number, number] = [106.660172, 10.762622]; // Ho Chi Minh City
export const BENCHMARK_ZOOM = 12;
export const WARDS_FILL_LAYER = "hcm-wards-fill";
export const ROAD_WARDS_SOURCE = "hcm-road-wards";
export const MBTILES_TILE_URL = import.meta.env.VITE_MBTILES_TILE_URL ?? "/data/hcm-road-wards/{z}/{x}/{y}.pbf";

