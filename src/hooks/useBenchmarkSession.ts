import { useCallback, useEffect, useRef, useState } from "react";
import type { Map } from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { useBenchmark } from "./useBenchmark";
import { useRawLayers } from "./useRawLayers";
import { useSyncedMaps } from "./useSyncedMaps";
import { waitForSourceRender } from "../map/waitForSourceRender";
import { clearStoredRuns, createBenchmarkRunId, getPageRunResources, readStoredRuns, saveStoredRuns } from "../services/benchmarkRuns";
import { fetchBenchmarkBoundary } from "../services/benchmarkBoundary";
import type { BenchmarkRun } from "../types";

export function useBenchmarkSession() {
  const tiledMapRef = useRef<Map | null>(null);
  const rawMapRef = useRef<Map | null>(null);
  const [tiledMap, setTiledMap] = useState<Map | null>(null);
  const [rawMap, setRawMap] = useState<Map | null>(null);
  const [runId] = useState(createBenchmarkRunId);
  const [startedAt] = useState(() => performance.now());
  const tiledReadyTime = useRef<Promise<number> | null>(null);
  const rawReadyTime = useRef<Promise<number> | null>(null);
  const boundaryLoaded = useRef({ tiled: false, raw: false });
  const boundaryFetchStarted = useRef(false);
  const autoLoadStarted = useRef(false);
  const autoBenchmarkStarted = useRef(false);
  const runGeneration = useRef(0);
  const [boundariesReady, setBoundariesReady] = useState(false);
  const [runs, setRuns] = useState<BenchmarkRun[]>(readStoredRuns);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { benchmark, refresh } = useBenchmark(runId);
  const { rawLayers, rawLoading, rawError, toggle: toggleRawLayer } = useRawLayers(rawMapRef, runId);

  const onTiledReady = useCallback((map: Map) => {
    tiledMapRef.current = map;
    tiledReadyTime.current = waitForSourceRender(map, ["hcm-road-wards", "hcm-boundary"], startedAt, () => boundaryLoaded.current.tiled);
    void tiledReadyTime.current.catch(() => undefined);
    setTiledMap(map);
  }, [startedAt]);

  const onRawReady = useCallback((map: Map) => {
    rawMapRef.current = map;
    rawReadyTime.current = waitForSourceRender(map, ["raw-roads", "hcm-boundary"], startedAt, () => boundaryLoaded.current.raw);
    void rawReadyTime.current.catch(() => undefined);
    setRawMap(map);
  }, [startedAt]);

  useEffect(() => {
    if (!rawMap || autoLoadStarted.current) return;
    autoLoadStarted.current = true;
    void toggleRawLayer("roads");
  }, [rawMap, toggleRawLayer]);

  useEffect(() => {
    if (!tiledMap || !rawMap || boundaryFetchStarted.current) return;
    boundaryFetchStarted.current = true;

    async function loadBoundary(map: Map, side: "tiled" | "raw") {
      const result = await fetchBenchmarkBoundary(side, runId);
      const source = map.getSource("hcm-boundary") as GeoJSONSource | undefined;
      if (!source) throw new Error(`${side} boundary source is missing`);
      await source.setData(result.data);
      boundaryLoaded.current[side] = true;
      map.triggerRepaint();
    }

    void Promise.all([loadBoundary(tiledMap, "tiled"), loadBoundary(rawMap, "raw")])
      .then(() => setBoundariesReady(true))
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : String(cause));
        setRunning(false);
      });
  }, [tiledMap, rawMap, runId]);

  useEffect(() => {
    if (!tiledMap || !rawMap || !boundariesReady || !rawLayers.roads || !rawLayers.wards || rawLoading || autoBenchmarkStarted.current) return;
    autoBenchmarkStarted.current = true;
    const generation = runGeneration.current;

    void (async () => {
      try {
        if (!tiledReadyTime.current || !rawReadyTime.current) throw new Error("Could not initialize measurements for both maps.");
        const [tiledReadyMs, rawReadyMs] = await Promise.all([tiledReadyTime.current, rawReadyTime.current]);
        const resources = getPageRunResources(runId, startedAt);
        refresh();
        if (!resources.complete || resources.tiledBytes <= 0 || resources.rawBytes <= 0)
          throw new Error(`Missing valid responses; this run was not saved. ${resources.coverage}`);

        const result: BenchmarkRun = {
          completedAt: new Date().toISOString(),
          tiledBytes: resources.tiledBytes,
          tiledReadyMs,
          tiledRequests: resources.tiledRequests,
          rawBytes: resources.rawBytes,
          rawReadyMs,
          rawRequests: resources.rawRequests,
          tiledNetworkMs: resources.tiledNetworkMs,
          rawNetworkMs: resources.rawNetworkMs,
          tiledAfterDownloadMs: Math.max(0, tiledReadyMs - resources.tiledLastResponseMs),
          rawAfterDownloadMs: Math.max(0, rawReadyMs - resources.rawLastResponseMs),
        };
        if (generation !== runGeneration.current) return;

        const nextRuns = [...runs, result];
        setRuns(nextRuns);
        try {
          saveStoredRuns(nextRuns);
          setError(null);
        } catch {
          setError("The run completed but could not be saved in local storage.");
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setRunning(false);
      }
    })();
  }, [runId, startedAt, rawLayers.roads, rawLayers.wards, rawLoading, rawMap, tiledMap, boundariesReady, runs, refresh]);

  useEffect(() => {
    if (!rawError || !running || autoBenchmarkStarted.current) return;
    setError(rawError);
    setRunning(false);
  }, [rawError, running]);

  useSyncedMaps(tiledMap, rawMap);

  function clearRuns() {
    runGeneration.current += 1;
    setRuns([]);
    setError(null);
    try {
      clearStoredRuns();
    } catch {
      setError("Could not clear saved results from local storage.");
    }
  }

  return {
    tiledMapRef,
    rawMapRef,
    runId,
    onTiledReady,
    onRawReady,
    benchmark,
    rawLoading,
    rawError,
    runs,
    running,
    error,
    clearRuns,
    rawLayers,
    toggleRawLayer,
  };
}
