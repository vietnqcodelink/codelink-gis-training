import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Map } from "maplibre-gl";
import { fetchRawGeoJson } from "../services/rawGeoJson";
import type { Benchmark, RawKind } from "../types";

export function useRawLayers(
  mapRef: MutableRefObject<Map | null>,
  setBenchmark: Dispatch<SetStateAction<Benchmark | null>>
) {
  const [rawLayers, setRawLayers] = useState<Record<RawKind, boolean>>({ roads: false, wards: false });
  const [rawLoading, setRawLoading] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const loaded = useRef<Record<RawKind, boolean>>({ roads: false, wards: false });
  const loadingKind = useRef<RawKind | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const toggle = useCallback(
    async (kind: RawKind) => {
      // Serialize large downloads so rapid clicks cannot add duplicate sources.
      if (loadingKind.current) return;
      const nextVisible = !rawLayers[kind];
      setRawLayers((current) => ({ ...current, [kind]: nextVisible }));
      const sourceId = `raw-${kind}`;
      const layerId = `raw-${kind}-line`;
      const companionLayerId = kind === "roads" ? "raw-roads-wards" : null;
      if (!nextVisible || loaded.current[kind]) {
        if (mapRef.current?.getLayer(layerId))
          mapRef.current.setLayoutProperty(layerId, "visibility", nextVisible ? "visible" : "none");
        if (companionLayerId && mapRef.current?.getLayer(companionLayerId))
          mapRef.current.setLayoutProperty(companionLayerId, "visibility", nextVisible ? "visible" : "none");
        return;
      }
      const map = mapRef.current;
      if (!map) return;
      if (map.getSource(sourceId)) {
        loaded.current[kind] = true;
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "visible");
        return;
      }
      setRawLoading(kind === "roads" ? "merged roads + wards" : "wards");
      setRawError(null);
      loadingKind.current = kind;
      abortController.current?.abort();
      const controller = new AbortController();
      abortController.current = controller;
      try {
        const result = await fetchRawGeoJson(kind, controller.signal);
        // The map may have been replaced while the request was in flight.
        if (mapRef.current !== map || map.getSource(sourceId)) return;
        map.addSource(sourceId, { type: "geojson", data: result.data });
        if (kind === "roads") {
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            filter: ["any", ["==", ["get", "dataset"], "roads"], ["!", ["has", "dataset"]]],
            paint: { "line-color": "#2563eb", "line-width": 1, "line-opacity": 0.75 },
          });
          map.addLayer({
            id: "raw-roads-wards",
            type: "fill",
            source: sourceId,
            filter: ["==", ["get", "dataset"], "wards"],
            paint: { "fill-color": "#7c3aed", "fill-opacity": 0.2 },
          });
        } else
          map.addLayer({
            id: layerId,
            type: "fill",
            source: sourceId,
            paint: { "fill-color": "#7c3aed", "fill-opacity": 0.2 },
          });
        loaded.current[kind] = true;
        const idleStart = performance.now();
        map.once("idle", () =>
          setBenchmark((current) => ({
            mapLoadMs: current?.mapLoadMs ?? 0,
            firstIdleMs: current?.firstIdleMs ?? 0,
            pmtilesBytes: current?.pmtilesBytes ?? 0,
            requests: current?.requests ?? [],
            raw: [
              ...(current?.raw ?? []).filter((metric) => metric.label !== kind),
              {
                label: kind,
                bytes: result.bytes,
                downloadMs: result.downloadMs,
                parseMs: result.parseMs,
                firstIdleMs: performance.now() - idleStart,
              },
            ],
          }))
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRawLayers((current) => ({ ...current, [kind]: false }));
        setRawError(error instanceof Error ? error.message : String(error));
      } finally {
        if (loadingKind.current === kind) loadingKind.current = null;
        if (abortController.current === controller) abortController.current = null;
        setRawLoading(null);
      }
    },
    [mapRef, rawLayers, setBenchmark]
  );

  useEffect(() => () => abortController.current?.abort(), []);

  return { rawLayers, rawLoading, rawError, toggle };
}
