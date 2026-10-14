import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { Map } from "maplibre-gl";
import { fetchRawGeoJson } from "../services/rawGeoJson";
import { addRoadLayers, roadLayerIds } from "../map/roadStyle";
import { addWardLayers, bindMapInteractions, SOURCE_COLORS } from "../map/layers";
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
      const layerIds = kind === "roads"
        ? roadLayerIds("raw-roads")
        : ["raw-roads-wards", "raw-wards-outline"];
      layerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", nextVisible ? "visible" : "none");
      });
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
      addRoadLayers(map, {
        source: "raw-roads",
        prefix: "raw-roads",
        visibility: layersToShow.roads ? "visible" : "none",
        filter: ["any", ["==", ["get", "dataset"], "roads"], ["!", ["has", "dataset"]]],
        color: SOURCE_COLORS.raw.roads,
      });
      addWardLayers(map, {
        source: "raw-roads",
        fillId: "raw-roads-wards",
        outlineId: "raw-wards-outline",
        fillColor: SOURCE_COLORS.raw.wards,
        outlineColor: SOURCE_COLORS.raw.wardOutline,
        visibility: layersToShow.wards ? "visible" : "none",
        filter: ["==", ["get", "dataset"], "wards"],
      });
      bindMapInteractions(map, ["raw-roads-wards"]);
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
