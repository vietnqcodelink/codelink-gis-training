import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map } from "maplibre-gl";
import { waitForSourceRender } from "../map/waitForSourceRender";
import { fetchBenchmarkBoundary } from "../services/benchmarkBoundary";

type Side = "tiled" | "raw";

export function useBenchmarkMapSetup(runId: string, startedAt: number) {
  const tiledMapRef = useRef<Map | null>(null);
  const rawMapRef = useRef<Map | null>(null);
  const tiledReadyTime = useRef<Promise<number> | null>(null);
  const rawReadyTime = useRef<Promise<number> | null>(null);
  const boundaryLoaded = useRef<Record<Side, boolean>>({ tiled: false, raw: false });
  const boundaryFetchStarted = useRef(false);
  const [tiledMap, setTiledMap] = useState<Map | null>(null);
  const [rawMap, setRawMap] = useState<Map | null>(null);
  const [boundariesReady, setBoundariesReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTiledReady = useCallback((map: Map) => {
    tiledMapRef.current = map;
    tiledReadyTime.current = waitForSourceRender(
      map,
      ["hcm-road-wards", "hcm-boundary"],
      startedAt,
      () => boundaryLoaded.current.tiled,
    );
    void tiledReadyTime.current.catch(() => undefined);
    setTiledMap(map);
  }, [startedAt]);

  const onRawReady = useCallback((map: Map) => {
    rawMapRef.current = map;
    rawReadyTime.current = waitForSourceRender(
      map,
      ["raw-roads", "hcm-boundary"],
      startedAt,
      () => boundaryLoaded.current.raw,
    );
    void rawReadyTime.current.catch(() => undefined);
    setRawMap(map);
  }, [startedAt]);

  useEffect(() => {
    if (!tiledMap || !rawMap || boundaryFetchStarted.current) return;
    boundaryFetchStarted.current = true;

    async function loadBoundary(map: Map, side: Side) {
      const { data } = await fetchBenchmarkBoundary(side, runId);
      const source = map.getSource("hcm-boundary") as GeoJSONSource | undefined;
      if (!source) throw new Error(`${side} boundary source is missing`);
      await source.setData(data);
      boundaryLoaded.current[side] = true;
      map.triggerRepaint();
    }

    void Promise.all([loadBoundary(tiledMap, "tiled"), loadBoundary(rawMap, "raw")])
      .then(() => setBoundariesReady(true))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [tiledMap, rawMap, runId]);

  return {
    tiledMapRef,
    rawMapRef,
    tiledMap,
    rawMap,
    tiledReadyTime,
    rawReadyTime,
    boundariesReady,
    error,
    onTiledReady,
    onRawReady,
  };
}
