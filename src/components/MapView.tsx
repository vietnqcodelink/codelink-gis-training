import { AttributionControl, Map, addProtocol, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { BENCHMARK_ZOOM, MAP_CENTER, MAP_STYLE } from "../config";
import { OSM_DATA_SNAPSHOT } from "../dataSnapshot";
import { addBoundaryLayers, addComparisonSources, addMapLayers, bindMapInteractions } from "../map/layers";

const protocol = new Protocol();
// Register once at module scope so React renders never duplicate the protocol.
addProtocol("pmtiles", protocol.tile);
setWorkerUrl(workerUrl);

type Props = {
  mapRef: MutableRefObject<Map | null>;
  variant: "tiled" | "raw";
  benchmarkRun: string;
  onMapReady?: (map: Map) => void;
};

export function MapView({ mapRef, variant, benchmarkRun, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: MAP_CENTER,
      zoom: BENCHMARK_ZOOM,
      attributionControl: false,
    });
    map.addControl(new AttributionControl({
      customAttribution: `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · Snapshot ${OSM_DATA_SNAPSHOT} · <a href="/data-manifest.json" target="_blank" rel="noopener noreferrer">Data checksums</a>`,
    }));
    mapRef.current = map;
    const onLoad = () => {
      if (variant === "tiled") {
        addMapLayers(map, benchmarkRun);
        addComparisonSources(map);
        bindMapInteractions(map, ["hcm-wards-fill", "mbtiles-wards-fill"]);
      } else {
        addBoundaryLayers(map);
      }
      onMapReady?.(map);

    };
    map.once("load", onLoad);

    // Explicit cleanup is important when React StrictMode remounts effects in dev.
    return () => {
      map.off("load", onLoad);
      mapRef.current = null;
      map.remove();
    };
  }, [mapRef, variant, benchmarkRun, onMapReady]);

  return (
    <div className="map-view-shell">
      <div ref={containerRef} className="map-canvas" role="application" />
    </div>
  );
}
