export async function fetchBenchmarkBoundary(side: "raw" | "tiled", runId: string) {
  const url = `/hcm.geojson?benchmark-map=${side}&benchmark-run=${encodeURIComponent(runId)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const data = await response.json();
  return { data };
}
