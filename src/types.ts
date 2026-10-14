export type RawKind = "roads" | "wards";
export type SharedLayer = RawKind | "boundary";
export type VectorSource = "pmtiles" | "mbtiles";

export type BenchmarkRequest = { url: string; bytes: number };
export type Benchmark = { requests: BenchmarkRequest[] };
export type BenchmarkRun = {
  completedAt: string;
  tiledBytes: number;
  tiledReadyMs: number;
  tiledRequests: number;
  rawBytes: number;
  rawReadyMs: number;
  rawRequests: number;
  tiledNetworkMs?: number;
  rawNetworkMs?: number;
  tiledAfterDownloadMs?: number;
  rawAfterDownloadMs?: number;
};
