import type { Benchmark } from "../types";

function rawBaselineBytes() {
  const entry = performance.getEntriesByName("/hcm-road-wards.geojson")[0] as PerformanceResourceTiming | undefined;
  return entry?.encodedBodySize || entry?.transferSize || 0;
}

export function BenchmarkPanel({
  benchmark,
  rawLoading,
  rawError,
}: {
  benchmark: Benchmark;
  rawLoading: string | null;
  rawError: string | null;
}) {
  return (
    <aside className="benchmark-panel" aria-label="Benchmark results">
      <strong>Benchmark</strong>
      <div className="benchmark-legend" aria-label="Layer color legend">
        <span>
          <i className="legend-swatch legend-swatch--pmtiles" />
          PMTiles roads / wards
        </span>
        <span>
          <i className="legend-swatch legend-swatch--raw-roads" />
          Raw roads GeoJSON
        </span>
        <span>
          <i className="legend-swatch legend-swatch--raw-wards" />
          Raw wards GeoJSON
        </span>
        <span>
          <i className="legend-swatch legend-swatch--mbtiles" />
          MBTiles roads
        </span>
        <span>
          <i className="legend-swatch legend-swatch--png-roads" />
          PNG roads
        </span>
        <span>
          <i className="legend-swatch legend-swatch--png-wards" />
          PNG wards
        </span>
      </div>
      <span>Map load: {benchmark.mapLoadMs.toFixed(0)} ms</span>
      <span>First idle: {benchmark.firstIdleMs.toFixed(0)} ms</span>
      <span>PMTiles transferred: {(benchmark.pmtilesBytes / 1024).toFixed(1)} KiB</span>
      <hr />
      <strong>Tile requests ({benchmark.requests.length})</strong>
      <span>Viewport transfer: {(benchmark.pmtilesBytes / 1024).toFixed(1)} KiB</span>
      <span>
        Raw GeoJSON baseline:{" "}
        {rawBaselineBytes() ? `${(rawBaselineBytes() / 1024).toFixed(0)} KiB` : "Load raw data to measure"}
      </span>
      <span>
        Transfer reduction:{" "}
        {rawBaselineBytes() ? `${(100 - (benchmark.pmtilesBytes / rawBaselineBytes()) * 100).toFixed(2)}%` : "—"}
      </span>
      {benchmark.requests.slice(-6).map((request, index) => (
        <span key={`${request.startMs}-${index}`} title={request.url}>
          #{index + 1} {request.file}: {(request.bytes / 1024).toFixed(1)} KiB / {request.durationMs.toFixed(0)} ms
        </span>
      ))}
      <hr />
      <strong>Raw GeoJSON comparison</strong>
      {benchmark.raw.map((metric) => (
        <span key={metric.label}>
          {metric.label}: {(metric.bytes / 1024).toFixed(0)} KiB / download {metric.downloadMs.toFixed(0)} ms / parse{" "}
          {metric.parseMs.toFixed(0)} ms / render {metric.firstIdleMs.toFixed(0)} ms
        </span>
      ))}
      {rawLoading && <span>Loading {rawLoading} GeoJSON…</span>}
      {rawError && <span className="benchmark-error">Raw GeoJSON error: {rawError}</span>}
    </aside>
  );
}
