import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Map } from "maplibre-gl";
import { fetchRawGeoJson } from "../services/rawGeoJson";
import type { RawKind } from "../types";

export function useRawLayers(
  mapRef: MutableRefObject<Map | null>,
  benchmarkRun: string
) {
  const [rawLayers, setRawLayers] = useState<Record<RawKind, boolean>>({ roads: false, wards: false });
  const [rawLoading, setRawLoading] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const loading = useRef(false);
  const abortController = useRef<AbortController | null>(null);

  const toggle = useCallback(async (kind: RawKind) => {
    if (loading.current) return;
    const nextVisible = !rawLayers[kind];
    const nextLayers = { ...rawLayers, [kind]: nextVisible };
    const map = mapRef.current;
    if (!map) return;
    if (map.getSource("raw-roads")) {
      const layerId = kind === "roads" ? "raw-roads-line" : "raw-roads-wards";
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", nextVisible ? "visible" : "none");
      setRawLayers(nextLayers);
      return;
    }
    if (!nextVisible) {
      setRawLayers(nextLayers);
      return;
    }

    setRawLayers(nextLayers);
    setRawLoading("merged roads + wards");
    setRawError(null);
    loading.current = true;
    const controller = new AbortController();
    abortController.current = controller;
    try {
      const result = await fetchRawGeoJson(controller.signal, benchmarkRun);
      if (mapRef.current !== map || map.getSource("raw-roads")) return;
      map.addSource("raw-roads", { type: "geojson", data: result.data });
      const layersToShow = kind === "roads" ? { roads: true, wards: true } : nextLayers;
      map.addLayer({
        id: "raw-roads-line",
        type: "line",
        source: "raw-roads",
        filter: ["any", ["==", ["get", "dataset"], "roads"], ["!", ["has", "dataset"]]],
        layout: { visibility: layersToShow.roads ? "visible" : "none" },
        paint: { "line-color": "#2563eb", "line-width": 1, "line-opacity": 0.75 },
      });
      map.addLayer({
        id: "raw-roads-wards",
        type: "fill",
        source: "raw-roads",
        filter: ["==", ["get", "dataset"], "wards"],
        layout: { visibility: layersToShow.wards ? "visible" : "none" },
        paint: { "fill-color": "#7c3aed", "fill-opacity": 0.2 },
      });
      setRawLayers(layersToShow);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setRawLayers((current) => ({ ...current, [kind]: false }));
      setRawError(error instanceof Error ? error.message : String(error));
    } finally {
      loading.current = false;
      if (abortController.current === controller) abortController.current = null;
      setRawLoading(null);
    }
  }, [mapRef, rawLayers, benchmarkRun]);

  useEffect(() => () => abortController.current?.abort(), []);

  return { rawLayers, rawLoading, rawError, toggle };
}
