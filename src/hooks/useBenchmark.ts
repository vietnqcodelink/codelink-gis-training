import { useCallback, useEffect, useState } from "react";
import type { Benchmark } from "../types";

const isTracked = (name: string) => name.includes(".pmtiles") || name.includes("/raster-roads/") || name.includes("/raster-wards/");

export function useBenchmark(mapLoadStart: number | null) {
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const readResources = useCallback(() => {
    // Resource Timing measures real browser transfer costs rather than estimates.
    const resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((entry) => isTracked(entry.name));
    const pmtiles = resources.filter((entry) => entry.name.includes(".pmtiles"));
    return {
      pmtilesBytes: pmtiles.reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0),
      requests: resources.map((entry) => ({ file: new URL(entry.name).pathname.split("/").pop() ?? entry.name, url: entry.name, bytes: entry.transferSize || entry.encodedBodySize || 0, durationMs: entry.duration, startMs: entry.startTime })),
    };
  }, []);

  const refresh = useCallback(() => {
    const resources = readResources();
    setBenchmark((current) => ({ mapLoadMs: current?.mapLoadMs ?? 0, firstIdleMs: current?.firstIdleMs ?? 0, ...resources, raw: current?.raw ?? [] }));
  }, [readResources]);

  useEffect(() => {
    if (mapLoadStart === null) return;
    const observer = typeof PerformanceObserver !== "undefined" ? new PerformanceObserver((list) => {
      if (list.getEntries().some((entry) => isTracked(entry.name))) refresh();
    }) : null;
    observer?.observe({ type: "resource", buffered: true });
    return () => observer?.disconnect();
  }, [mapLoadStart, refresh]);

  return { benchmark, setBenchmark, refresh, readResources };
}
