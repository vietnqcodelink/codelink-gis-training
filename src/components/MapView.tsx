import { Map, addProtocol, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { MAP_CENTER, MAP_STYLE } from "../config";
import { addComparisonSources, addMapLayers, bindMapInteractions } from "../map/layers";
import type { Benchmark } from "../types";

const protocol = new Protocol();
// Register once at module scope so React renders never duplicate the protocol.
addProtocol("pmtiles", protocol.tile);
setWorkerUrl(workerUrl);

type Props = {
  mapRef: MutableRefObject<Map | null>;
  setMapLoadStart: (value: number) => void;
  refresh: () => void;
  readResources: () => Pick<Benchmark, "pmtilesBytes" | "requests">;
  setBenchmark: Dispatch<SetStateAction<Benchmark | null>>;
};

export function MapView({ mapRef, setMapLoadStart, refresh, readResources, setBenchmark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const benchmarkStart = performance.now();
    setMapLoadStart(benchmarkStart);
    const map = new Map({ container: containerRef.current, style: MAP_STYLE, center: MAP_CENTER, zoom: 8 });
    mapRef.current = map;
    // Only PMTiles source events contribute to the transfer benchmark.
    const onData = (event: unknown) => {
      if (typeof event === "object" && event !== null && "sourceId" in event && event.sourceId === "hcm-road-wards")
        refresh();
    };
    const onLoad = () => {
      // Add map layers and comparison sources
      addMapLayers(map);
      addComparisonSources(map);
      bindMapInteractions(map);
      map.on("data", onData);

      setBenchmark((current) => ({
        mapLoadMs: performance.now() - benchmarkStart,
        firstIdleMs: current?.firstIdleMs ?? 0,
        pmtilesBytes: current?.pmtilesBytes ?? 0,
        requests: current?.requests ?? [],
        raw: current?.raw ?? [],
      }));
      map.once("idle", () =>
        // Check benchmark after the map is loaded and idle
        setBenchmark((current) => ({
          mapLoadMs: current?.mapLoadMs ?? performance.now() - benchmarkStart,
          firstIdleMs: performance.now() - benchmarkStart,
          ...readResources(),
          raw: current?.raw ?? [],
        }))
      );
    };
    map.once("load", onLoad);

    // Explicit cleanup is important when React StrictMode remounts effects in dev.
    return () => {
      map.off("data", onData);
      map.off("load", onLoad);
      mapRef.current = null;
      map.remove();
    };
  }, [mapRef, readResources, refresh, setBenchmark, setMapLoadStart]);

  return <div ref={containerRef} id="map" role="application" aria-label="Interactive GIS map" />;
}
