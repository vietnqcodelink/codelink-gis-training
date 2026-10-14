import { useEffect } from "react";
import type { Map } from "maplibre-gl";

export function useSyncedMaps(tiledMap: Map | null, rawMap: Map | null) {
  useEffect(() => {
    if (!tiledMap || !rawMap) return;

    const sync = (source: Map, target: Map) => {
      const center = source.getCenter();
      const targetCenter = target.getCenter();
      if (
        Math.abs(center.lng - targetCenter.lng) < 1e-7 &&
        Math.abs(center.lat - targetCenter.lat) < 1e-7 &&
        Math.abs(source.getZoom() - target.getZoom()) < 1e-5 &&
        Math.abs(source.getBearing() - target.getBearing()) < 1e-5 &&
        Math.abs(source.getPitch() - target.getPitch()) < 1e-5
      ) return;

      target.jumpTo({ center, zoom: source.getZoom(), bearing: source.getBearing(), pitch: source.getPitch() });
    };
    const syncFromTiled = () => sync(tiledMap, rawMap);
    const syncFromRaw = () => sync(rawMap, tiledMap);
    tiledMap.on("move", syncFromTiled);
    rawMap.on("move", syncFromRaw);

    return () => {
      tiledMap.off("move", syncFromTiled);
      rawMap.off("move", syncFromRaw);
    };
  }, [tiledMap, rawMap]);
}
