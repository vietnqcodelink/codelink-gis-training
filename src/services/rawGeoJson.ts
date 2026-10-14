export async function fetchRawGeoJson(signal?: AbortSignal, benchmarkRun?: string) {
  const path = "/hcm-road-wards.geojson";
  const url = benchmarkRun
    ? `${path}?benchmark-map=raw&benchmark-run=${encodeURIComponent(benchmarkRun)}`
    : path;
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const data = await response.json();
  return { data };
}
