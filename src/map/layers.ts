import { Map, Popup } from "maplibre-gl";
import { MBTILES_TILE_URL, ROAD_WARDS_SOURCE, WARDS_FILL_LAYER } from "../config";

export function addMapLayers(map: Map) {
  // The primary path is PMTiles: the browser reads only viewport byte ranges.
  map.addSource(ROAD_WARDS_SOURCE, { type: "vector", url: "pmtiles:///hcm-road-wards.pmtiles" });
  map.addLayer({ id: "roads-line", type: "line", source: ROAD_WARDS_SOURCE, "source-layer": "roads", paint: {
    "line-color": "#d33", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 12, 1.5, 16, 4],
    "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.25, 12, 0.6, 16, 1],
  }});
  map.addSource("hcm-boundary", { type: "geojson", data: "/hcm.geojson" });
  map.addLayer({ id: "hcm-fill", type: "fill", source: "hcm-boundary", paint: { "fill-color": "#0f766e", "fill-opacity": 0.22 } });
  map.addLayer({ id: "hcm-outline", type: "line", source: "hcm-boundary", paint: { "line-color": "#115e59", "line-width": 2 } });
  map.addLayer({ id: WARDS_FILL_LAYER, type: "fill", source: ROAD_WARDS_SOURCE, "source-layer": "wards", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.12 } });
  map.addLayer({ id: "hcm-wards-outline", type: "line", source: ROAD_WARDS_SOURCE, "source-layer": "wards", paint: { "line-color": "#b45309", "line-width": 1.2, "line-opacity": 0.85 } });
}

export function addComparisonSources(map: Map) {
  // Comparison sources start hidden and are enabled on demand by the panel.
  map.addSource("mbtiles", { type: "vector", tiles: [MBTILES_TILE_URL], minzoom: 10, maxzoom: 16 });
  map.addLayer({ id: "mbtiles-roads", type: "line", source: "mbtiles", "source-layer": "roads", layout: { visibility: "none" }, paint: { "line-color": "#0891b2", "line-width": 2, "line-opacity": 0.8 } });
  map.addSource("png-roads", { type: "raster", tiles: ["/raster-roads/{z}/{x}/{y}.png"], tileSize: 256, minzoom: 8, maxzoom: 12 });
  map.addLayer({ id: "png-roads-layer", type: "raster", source: "png-roads", layout: { visibility: "none" }, paint: { "raster-opacity": 0.65 } });
  map.addSource("png-wards", { type: "raster", tiles: ["/raster-wards/{z}/{x}/{y}.png"], tileSize: 256, minzoom: 8, maxzoom: 12 });
  map.addLayer({ id: "png-wards-layer", type: "raster", source: "png-wards", layout: { visibility: "none" }, paint: { "raster-opacity": 0.45 } });
}

export function bindMapInteractions(map: Map) {
  map.on("click", WARDS_FILL_LAYER, (event) => {
    const properties = event.features?.[0]?.properties;
    const name = String(properties?.name ?? properties?.NAME_3 ?? properties?.ten ?? "Ward");
    const district = properties?.district ?? properties?.NAME_2;
    new Popup({ closeButton: true, maxWidth: "280px" }).setLngLat(event.lngLat).setText(district ? `${name}\n${String(district)}` : name).addTo(map);
  });
  map.on("mouseenter", WARDS_FILL_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", WARDS_FILL_LAYER, () => { map.getCanvas().style.cursor = ""; });
}
