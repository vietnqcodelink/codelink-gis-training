import type { BenchmarkRun } from "../types";

const RUNS_STORAGE_KEY = "gis-map-benchmark-runs-v2";

export function createBenchmarkRunId() {
  return `${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function readStoredRuns(): BenchmarkRun[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RUNS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((run): run is BenchmarkRun =>
      run && typeof run === "object" &&
      ["tiledBytes", "tiledReadyMs", "tiledRequests", "rawBytes", "rawReadyMs", "rawRequests"]
        .every((key) => typeof run[key] === "number" && Number.isFinite(run[key])) &&
      typeof run.completedAt === "string"
    );
  } catch {
    return [];
  }
}

export function saveStoredRuns(runs: BenchmarkRun[]) {
  localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs));
}

export function clearStoredRuns() {
  localStorage.removeItem(RUNS_STORAGE_KEY);
}

export function getPageRunResources(runId: string, pageStartedAt: number) {
  const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).flatMap((entry) => {
    try {
      const url = new URL(entry.name);
      if (url.searchParams.get("benchmark-run") !== runId) return [];
      if (entry.responseStatus !== 0 && (entry.responseStatus < 200 || entry.responseStatus >= 300)) return [];
      return [{ entry, url }];
    } catch {
      return [];
    }
  });
  const select = (predicate: (url: URL) => boolean) => entries.filter(({ url }) => predicate(url));
  const tiledArchive = select((url) => url.pathname.endsWith(".pmtiles"));
  const tiledBoundary = select((url) => url.pathname.endsWith("/hcm.geojson") && url.searchParams.get("benchmark-map") === "tiled");
  const rawRoads = select((url) => url.pathname.endsWith("/hcm-road-wards.geojson") && url.searchParams.get("benchmark-map") === "raw");
  const rawBoundary = select((url) => url.pathname.endsWith("/hcm.geojson") && url.searchParams.get("benchmark-map") === "raw");
  const bytes = (items: typeof entries) => items.reduce((total, { entry }) => total + entry.encodedBodySize, 0);
  const span = (items: typeof entries) => items.length
    ? Math.max(...items.map(({ entry }) => entry.responseEnd)) - Math.min(...items.map(({ entry }) => entry.startTime))
    : 0;
  const lastResponse = (items: typeof entries) => items.length
    ? Math.max(...items.map(({ entry }) => entry.responseEnd)) - pageStartedAt
    : 0;
  const tiled = [...tiledArchive, ...tiledBoundary];
  const raw = [...rawRoads, ...rawBoundary];
  const tiledArchiveBytes = bytes(tiledArchive);
  const tiledBoundaryBytes = bytes(tiledBoundary);
  const rawRoadsBytes = bytes(rawRoads);
  const rawBoundaryBytes = bytes(rawBoundary);

  return {
    tiledBytes: tiledArchiveBytes + tiledBoundaryBytes,
    tiledRequests: tiled.length,
    rawBytes: rawRoadsBytes + rawBoundaryBytes,
    rawRequests: raw.length,
    tiledNetworkMs: span(tiled),
    rawNetworkMs: span(raw),
    tiledLastResponseMs: lastResponse(tiled),
    rawLastResponseMs: lastResponse(raw),
    complete: tiledArchiveBytes > 0 && tiledBoundaryBytes > 0 && rawRoadsBytes > 0 && rawBoundaryBytes > 0,
    coverage: `PMTiles ${tiledArchive.length} req/${(tiledArchiveBytes / 1024).toFixed(1)} KiB; boundary Tiled ${tiledBoundary.length}/${(tiledBoundaryBytes / 1024).toFixed(1)} KiB; GeoJSON ${rawRoads.length}/${(rawRoadsBytes / 1024).toFixed(1)} KiB; boundary Raw ${rawBoundary.length}/${(rawBoundaryBytes / 1024).toFixed(1)} KiB`,
  };
}
