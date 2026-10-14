import { useState } from "react";
import type { Map } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { VECTOR_SOURCE_LAYERS } from "../map/layers";
import type { RawKind, SharedLayer, VectorSource } from "../types";

const BOUNDARY_LAYERS = ["hcm-fill", "hcm-outline"];
const PNG_LAYERS = ["png-roads-layer", "png-wards-layer"];

function setLayerVisibility(map: Map | null, layerIds: readonly string[], visible: boolean) {
  for (const id of layerIds) {
    if (map?.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export function useComparisonLayers(
  tiledMapRef: MutableRefObject<Map | null>,
  rawMapRef: MutableRefObject<Map | null>,
  rawLayers: Record<RawKind, boolean>,
  toggleRawLayer: (layer: RawKind) => void,
) {
  const [layerVisibility, setLayerVisibilityState] = useState<Record<SharedLayer, boolean>>({
    roads: true,
    wards: true,
    boundary: true,
  });
  const [vectorSource, setVectorSource] = useState<VectorSource>("pmtiles");
  const [pngVisible, setPngVisible] = useState(false);

  function toggleLayer(layer: SharedLayer) {
    const visible = !layerVisibility[layer];
    const layerIds = layer === "boundary" ? BOUNDARY_LAYERS : VECTOR_SOURCE_LAYERS[vectorSource][layer];
    setLayerVisibility(tiledMapRef.current, layerIds, visible);
    setLayerVisibilityState((current) => ({ ...current, [layer]: visible }));

    if (layer === "boundary") setLayerVisibility(rawMapRef.current, BOUNDARY_LAYERS, visible);
    else if (rawLayers[layer] !== visible) toggleRawLayer(layer);
  }

  function togglePng() {
    const visible = !pngVisible;
    setLayerVisibility(tiledMapRef.current, PNG_LAYERS, visible);
    setPngVisible(visible);
  }

  function selectVectorSource(source: VectorSource) {
    if (source === vectorSource) return;

    const inactiveSource = source === "pmtiles" ? "mbtiles" : "pmtiles";
    for (const kind of ["roads", "wards"] as const) {
      setLayerVisibility(tiledMapRef.current, VECTOR_SOURCE_LAYERS[inactiveSource][kind], false);
      setLayerVisibility(tiledMapRef.current, VECTOR_SOURCE_LAYERS[source][kind], layerVisibility[kind]);
    }
    setVectorSource(source);
  }

  return { layerVisibility, vectorSource, pngVisible, toggleLayer, togglePng, selectVectorSource };
}
