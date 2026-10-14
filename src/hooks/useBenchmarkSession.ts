import { useEffect, useRef, useState } from "react";
import { useBenchmark } from "./useBenchmark";
import { useBenchmarkMapSetup } from "./useBenchmarkMapSetup";
import { useRawLayers } from "./useRawLayers";
import { useSyncedMaps } from "./useSyncedMaps";
import { clearStoredRuns, createBenchmarkRunId, getPageRunResources, readStoredRuns, saveStoredRuns } from "../services/benchmarkRuns";
import type { BenchmarkRun } from "../types";

export function useBenchmarkSession() {
  const [runId] = useState(createBenchmarkRunId);
  const [startedAt] = useState(() => performance.now());
  const maps = useBenchmarkMapSetup(runId, startedAt);
  const {
    tiledMapRef,
    rawMapRef,
    tiledMap,
    rawMap,
    tiledReadyTime,
    rawReadyTime,
    boundariesReady,
    error: mapError,
  } = maps;
  const autoLoadStarted = useRef(false);
  const autoBenchmarkStarted = useRef(false);
  const runGeneration = useRef(0);
  const [runs, setRuns] = useState<BenchmarkRun[]>(readStoredRuns);
  const [benchmarkRunning, setBenchmarkRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const running = benchmarkRunning && !mapError;
  const sessionError = mapError ?? error;
  const { benchmark, refresh } = useBenchmark(runId);
  const { rawLayers, rawLoading, rawError, toggle: toggleRawLayer } = useRawLayers(rawMapRef, runId);

  useEffect(() => {
    if (!rawMap || autoLoadStarted.current) return;
    autoLoadStarted.current = true;
    void toggleRawLayer("roads");
  }, [rawMap, toggleRawLayer]);

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
        setBenchmarkRunning(false);
      }
    })();
  }, [runId, startedAt, rawLayers.roads, rawLayers.wards, rawLoading, tiledMap, rawMap, boundariesReady, tiledReadyTime, rawReadyTime, runs, refresh]);

  useEffect(() => {
    if (!rawError || !running || autoBenchmarkStarted.current) return;
    setError(rawError);
    setBenchmarkRunning(false);
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
    onTiledReady: maps.onTiledReady,
    onRawReady: maps.onRawReady,
    benchmark,
    rawLoading,
    rawError,
    runs,
    running,
    error: sessionError,
    clearRuns,
    rawLayers,
    toggleRawLayer,
  };
}
