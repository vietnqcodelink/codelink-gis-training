export type LayerId = "roads" | "hcm" | "wards";
export type RawKind = "roads" | "wards";
export type ComparisonKind = "mbtiles" | "png";

export type BenchmarkRequest = { file: string; url: string; bytes: number; durationMs: number; startMs: number };
export type RawMetric = { label: string; bytes: number; downloadMs: number; parseMs: number; firstIdleMs: number };
export type Benchmark = {
  mapLoadMs: number;
  firstIdleMs: number;
  pmtilesBytes: number;
  requests: BenchmarkRequest[];
  raw: RawMetric[];
};
