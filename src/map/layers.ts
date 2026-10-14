import { Map, Popup } from "maplibre-gl";
import { MBTILES_TILE_URL, ROAD_WARDS_SOURCE, WARDS_FILL_LAYER } from "../config";
import type { FilterSpecification } from "maplibre-gl";
import { addRoadLayers, roadLayerIds } from "./roadStyle";

export const SOURCE_COLORS = {
  pmtiles: { roads: "#d33", wards: "#60a5fa", wardOutline: "#1d4ed8" },
  mbtiles: { roads: "#0891b2", wards: "#84cc16", wardOutline: "#4d7c0f" },
  raw: { roads: "#2563eb", wards: "#a855f7", wardOutline: "#7e22ce" },
} as const;

type WardLayerOptions = {
  source: string;
  sourceLayer?: string;
  fillId: string;
  outlineId: string;
  fillColor: string;
  outlineColor: string;
  visibility?: "visible" | "none";
  filter?: FilterSpecification;
};

export function addWardLayers(map: Map, options: WardLayerOptions) {
  const { source, sourceLayer, fillId, outlineId, fillColor, outlineColor, visibility = "visible", filter } = options;
  const layerSource = { source, ...(sourceLayer ? { "source-layer": sourceLayer } : {}) };
  const common = { ...layerSource, ...(filter ? { filter } : {}), layout: { visibility } };
  map.addLayer({
    id: fillId,
    type: "fill",
    ...common,
    paint: { "fill-color": fillColor, "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: outlineId,
    type: "line",
    ...common,
    paint: { "line-color": outlineColor, "line-width": 1.2, "line-opacity": 0.85 },
  });
}

export function addBoundaryLayers(map: Map) {
  map.addSource("hcm-boundary", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "hcm-fill", type: "fill", source: "hcm-boundary", paint: { "fill-color": "#0f766e", "fill-opacity": 0.22 } });
  map.addLayer({ id: "hcm-outline", type: "line", source: "hcm-boundary", paint: { "line-color": "#115e59", "line-width": 2 } });
}

export const VECTOR_SOURCE_LAYERS = {
  pmtiles: { roads: roadLayerIds("roads"), wards: ["hcm-wards-fill", "hcm-wards-outline"] },
  mbtiles: { roads: roadLayerIds("mbtiles-roads"), wards: ["mbtiles-wards-fill", "mbtiles-wards-outline"] },
} as const;

export function addMapLayers(map: Map, benchmarkRun: string) {
  // The primary path is PMTiles: the browser reads only viewport byte ranges.
  map.addSource(ROAD_WARDS_SOURCE, { type: "vector", url: `pmtiles:///hcm-road-wards.pmtiles?benchmark-run=${encodeURIComponent(benchmarkRun)}` });
  addRoadLayers(map, { source: ROAD_WARDS_SOURCE, prefix: "roads", sourceLayer: "roads", color: SOURCE_COLORS.pmtiles.roads });
  addBoundaryLayers(map);
  addWardLayers(map, {
    source: ROAD_WARDS_SOURCE,
    sourceLayer: "wards",
    fillId: WARDS_FILL_LAYER,
    outlineId: "hcm-wards-outline",
    fillColor: SOURCE_COLORS.pmtiles.wards,
    outlineColor: SOURCE_COLORS.pmtiles.wardOutline,
  });
}

export function addComparisonSources(map: Map) {
  // Comparison sources start hidden and are enabled on demand by the panel.
  map.addSource("mbtiles", { type: "vector", tiles: [MBTILES_TILE_URL], minzoom: 10, maxzoom: 16 });
  addRoadLayers(map, { source: "mbtiles", prefix: "mbtiles-roads", sourceLayer: "roads", visibility: "none", color: SOURCE_COLORS.mbtiles.roads });
  addWardLayers(map, {
    source: "mbtiles",
    sourceLayer: "wards",
    fillId: "mbtiles-wards-fill",
    outlineId: "mbtiles-wards-outline",
    fillColor: SOURCE_COLORS.mbtiles.wards,
    outlineColor: SOURCE_COLORS.mbtiles.wardOutline,
    visibility: "none",
  });
  map.addSource("png-roads", { type: "raster", tiles: ["/raster-roads/{z}/{x}/{y}.png"], tileSize: 256, minzoom: 8, maxzoom: 12 });
  map.addLayer({ id: "png-roads-layer", type: "raster", source: "png-roads", layout: { visibility: "none" }, paint: { "raster-opacity": 0.65 } });
  map.addSource("png-wards", { type: "raster", tiles: ["/raster-wards/{z}/{x}/{y}.png"], tileSize: 256, minzoom: 8, maxzoom: 12 });
  map.addLayer({ id: "png-wards-layer", type: "raster", source: "png-wards", layout: { visibility: "none" }, paint: { "raster-opacity": 0.45 } });
}

export function bindMapInteractions(map: Map, layerIds: string[]) {
  map.on("click", layerIds, (event) => {
    const properties = event.features?.[0]?.properties;
    const name = String(properties?.name ?? properties?.NAME_3 ?? properties?.ten ?? "Ward");
    const district = properties?.district ?? properties?.NAME_2;
    new Popup({ closeButton: true, maxWidth: "280px" }).setLngLat(event.lngLat).setText(district ? `${name}\n${String(district)}` : name).addTo(map);
  });
  map.on("mouseenter", layerIds, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", layerIds, () => { map.getCanvas().style.cursor = ""; });
}
