import { useCallback, useState } from "react";
import type { Benchmark } from "../types";

// Count payload bytes consistently (compressed response body, excluding HTTP headers).
// The HCM boundary is a GeoJSON request, so include it alongside PMTiles ranges.
const isTracked = (name: string) => name.includes(".pmtiles") || name.includes("/hcm.geojson") || name.includes("/hcm-road-wards.geojson");
const payloadBytes = (entry: PerformanceResourceTiming) => entry.encodedBodySize;
const isBoundary = (name: string, side: "raw" | "tiled") => {
  try {
    const url = new URL(name);
    return url.pathname.endsWith("/hcm.geojson") && url.searchParams.get("benchmark-map") === side;
  } catch {
    return false;
  }
};

export function useBenchmark(benchmarkRun: string) {
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const readResources = useCallback(() => {
    // Resource Timing measures real browser transfer costs rather than estimates.
    const resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((entry) => {
      if (!isTracked(entry.name)) return false;
      try {
        return new URL(entry.name).searchParams.get("benchmark-run") === benchmarkRun;
      } catch {
        return false;
      }
    });
    const mapData = resources.filter((entry) => entry.name.includes(".pmtiles") || isBoundary(entry.name, "tiled"));
    const rawRoads = resources.filter((entry) => new URL(entry.name).pathname.endsWith("/hcm-road-wards.geojson"));
    const rawBoundary = resources.filter((entry) => isBoundary(entry.name, "raw"));
    return [...mapData, ...rawRoads, ...rawBoundary].map((entry) => ({
      url: entry.name,
      bytes: payloadBytes(entry),
    }));
  }, [benchmarkRun]);

  const refresh = useCallback(() => {
    setBenchmark({ requests: readResources() });
  }, [readResources]);

  return { benchmark, refresh };
}
