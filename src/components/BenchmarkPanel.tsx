import type { Benchmark, BenchmarkRun, BenchmarkRequest } from "../types";

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatTime(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

function requestSide(request: BenchmarkRequest) {
  const url = new URL(request.url, window.location.href);
  return url.pathname.endsWith(".pmtiles") || url.searchParams.get("benchmark-map") === "tiled" ? "tiled" : "raw";
}

function friendlyFileName(request: BenchmarkRequest) {
  const pathname = new URL(request.url, window.location.href).pathname;
  if (pathname.endsWith(".pmtiles")) return "Vector tile archive";
  if (pathname.endsWith("/hcm-road-wards.geojson")) return "Roads + wards data";
  if (pathname.endsWith("/hcm.geojson")) return "City boundary";
  return pathname.split("/").pop() || pathname;
}

function FileBreakdown({ title, requests }: { title: string; requests: BenchmarkRequest[] }) {
  const files = new Map<string, BenchmarkRequest[]>();
  requests.forEach((request) => {
    const key = new URL(request.url, window.location.href).pathname;
    files.set(key, [...(files.get(key) ?? []), request]);
  });
  if (!requests.length) return <div className="benchmark-empty">No data files recorded.</div>;
  return <div className="benchmark-file-group">
    <h4>{title}</h4>
    {[...files.values()].map((items) => {
      const request = items[0];
      const bytes = items.reduce((total, item) => total + item.bytes, 0);
      return <div className="benchmark-file-row" key={request.url}>
        <div className="benchmark-file-title"><b>{friendlyFileName(request)}</b><small>{new URL(request.url, window.location.href).pathname.split("/").pop()} · {items.length} request{items.length === 1 ? "" : "s"}</small></div>
        <b>{formatBytes(bytes)}</b>
      </div>;
    })}
  </div>;
}

export function BenchmarkPanel({ benchmark, rawLoading, rawError, runs, running, runError, onClear }: { benchmark: Benchmark; rawLoading: string | null; rawError: string | null; runs: BenchmarkRun[]; running: boolean; runError: string | null; onClear: () => void }) {
  const medianOf = (get: (run: BenchmarkRun) => number) => median(runs.map(get));
  const tiledRequests = benchmark.requests.filter((request) => requestSide(request) === "tiled");
  const rawRequests = benchmark.requests.filter((request) => requestSide(request) === "raw");
  const latestRun = runs.at(-1);
  const latestStageLabel = (value: number | undefined) => typeof value === "number" ? formatTime(value) : "—";
  const tiledTime = medianOf((run) => run.tiledReadyMs);
  const rawTime = medianOf((run) => run.rawReadyMs);
  return (
    <aside className="benchmark-panel" aria-label="Map performance comparison">
      <header className="benchmark-panel-header">
        <h2>Benchmark - Zoom 12</h2>
        <div className="benchmark-history-actions">{running && <span className="benchmark-status is-running">Measuring…</span>}<button className="benchmark-clear-button" onClick={onClear} disabled={!runs.length}>Clear</button></div>
      </header>
      {(rawLoading || rawError || runError) && <div className="benchmark-notice">{rawLoading && <span>Loading map data…</span>}{rawError && <span className="benchmark-error">{rawError}</span>}{runError && <span className="benchmark-error">Run not saved: {runError}</span>}</div>}

      <section className="benchmark-median" aria-label="Median comparison">
        <div className="benchmark-metric-label">MEDIAN <span>{runs.length ? `· ${runs.length} completed runs` : "· no completed runs"}</span></div>
        <div className="benchmark-compare-grid">
          <article className="benchmark-compare-card tiled">
            <h3><i />Vector tiles</h3>
            <div className="benchmark-primary-metric">{tiledTime === null ? "—" : formatTime(tiledTime)}<small>time until map is fully drawn</small></div>
            <div className="benchmark-submetrics"><span>Data transferred</span><b>{runs.length ? formatBytes(medianOf((run) => run.tiledBytes) ?? 0) : "—"}</b><span>Requests</span><b>{runs.length ? `${Math.round(medianOf((run) => run.tiledRequests) ?? 0)}` : "—"}</b></div>
            <div className="benchmark-stage-list"><strong>Latest run</strong><span>File transfer</span><b>{latestStageLabel(latestRun?.tiledNetworkMs)}</b><span>After transfer to draw</span><b>{latestStageLabel(latestRun?.tiledAfterDownloadMs)}</b></div>
          </article>
          <article className="benchmark-compare-card raw">
            <h3><i />GeoJSON</h3>
            <div className="benchmark-primary-metric">{rawTime === null ? "—" : formatTime(rawTime)}<small>time until map is fully drawn</small></div>
            <div className="benchmark-submetrics"><span>Data transferred</span><b>{runs.length ? formatBytes(medianOf((run) => run.rawBytes) ?? 0) : "—"}</b><span>Requests</span><b>{runs.length ? `${Math.round(medianOf((run) => run.rawRequests) ?? 0)}` : "—"}</b></div>
            <div className="benchmark-stage-list"><strong>Latest run</strong><span>File transfer</span><b>{latestStageLabel(latestRun?.rawNetworkMs)}</b><span>After transfer to draw</span><b>{latestStageLabel(latestRun?.rawAfterDownloadMs)}</b></div>
          </article>
        </div>
      </section>

      <section className="benchmark-files">
        <div className="benchmark-section-heading"><h3>Files loaded</h3><span>{benchmark.requests.length} requests · initial load</span></div>
        <div className="benchmark-file-groups"><FileBreakdown title="Vector tiles" requests={tiledRequests} /><FileBreakdown title="GeoJSON" requests={rawRequests} /></div>
      </section>

      {runs.length > 0 && <details className="benchmark-history"><summary>Run history · {runs.length}</summary><div className="benchmark-history-scroll"><table className="benchmark-table"><thead><tr><th>Run</th><th>Vector tiles · time / data</th><th>GeoJSON · time / data</th></tr></thead><tbody>{runs.slice(-12).reverse().map((run, index) => <tr key={`${run.completedAt}-${index}`}><th title={new Date(run.completedAt).toLocaleString()}>{runs.length - index}</th><td>{formatTime(run.tiledReadyMs)} · {formatBytes(run.tiledBytes)}</td><td>{formatTime(run.rawReadyMs)} · {formatBytes(run.rawBytes)}</td></tr>)}</tbody></table></div></details>}
    </aside>
  );
}
