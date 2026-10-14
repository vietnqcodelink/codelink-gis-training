import { useState } from "react";
import "./App.css";
import { BenchmarkPanel } from "./components/BenchmarkPanel";
import { ComparisonToolbar } from "./components/ComparisonToolbar";
import { MapView } from "./components/MapView";
import { useBenchmarkSession } from "./hooks/useBenchmarkSession";
import { VECTOR_SOURCE_LAYERS } from "./map/layers";

const EMPTY_BENCHMARK = { requests: [] };

function App() {
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const [tiledVisibility, setTiledVisibility] = useState({ roads: true, wards: true, boundary: true });
  const [vectorSource, setVectorSource] = useState<"pmtiles" | "mbtiles">("pmtiles");
  const [pngVisible, setPngVisible] = useState(false);
  const {
    tiledMapRef, rawMapRef, runId, onTiledReady, onRawReady,
    benchmark, rawLoading, rawError, runs, running, error,
    clearRuns, rawLayers, toggleRawLayer,
  } = useBenchmarkSession();

  function toggleTiledLayer(kind: keyof typeof tiledVisibility) {
    const next = !tiledVisibility[kind];
    const ids = kind === "boundary" ? ["hcm-fill", "hcm-outline"] : VECTOR_SOURCE_LAYERS[vectorSource][kind];
    ids.forEach((id) => {
      if (tiledMapRef.current?.getLayer(id))
        tiledMapRef.current.setLayoutProperty(id, "visibility", next ? "visible" : "none");
    });
    setTiledVisibility((current) => ({ ...current, [kind]: next }));
  }
  function toggleSharedLayer(kind: keyof typeof tiledVisibility) {
    const next = !tiledVisibility[kind];
    toggleTiledLayer(kind);
    if (kind === "boundary") {
      ["hcm-fill", "hcm-outline"].forEach((id) => {
        if (rawMapRef.current?.getLayer(id))
          rawMapRef.current.setLayoutProperty(id, "visibility", next ? "visible" : "none");
      });
    } else if (rawLayers[kind] !== next) void toggleRawLayer(kind);
  }

  function togglePngLayer() {
    const next = !pngVisible;
    const ids = ["png-roads-layer", "png-wards-layer"];
    ids.forEach((id) => {
      if (tiledMapRef.current?.getLayer(id))
        tiledMapRef.current.setLayoutProperty(id, "visibility", next ? "visible" : "none");
    });
    setPngVisible(next);
  }

  function selectVectorSource(source: "pmtiles" | "mbtiles") {
    if (source === vectorSource) return;
    const inactiveSource = source === "pmtiles" ? "mbtiles" : "pmtiles";
    for (const id of [...VECTOR_SOURCE_LAYERS[inactiveSource].roads, ...VECTOR_SOURCE_LAYERS[inactiveSource].wards]) {
      if (tiledMapRef.current?.getLayer(id)) tiledMapRef.current.setLayoutProperty(id, "visibility", "none");
    }
    for (const kind of ["roads", "wards"] as const) {
      const ids = VECTOR_SOURCE_LAYERS[source][kind];
      for (const id of ids) {
        if (tiledMapRef.current?.getLayer(id)) tiledMapRef.current.setLayoutProperty(id, "visibility", tiledVisibility[kind] ? "visible" : "none");
      }
    }
    setVectorSource(source);
  }

  return (
    <main className="benchmark-app">
      <ComparisonToolbar
        benchmarkOpen={benchmarkOpen}
        benchmarkRunning={running}
        rawLoading={rawLoading}
        layerVisibility={tiledVisibility}
        vectorSource={vectorSource}
        pngVisible={pngVisible}
        onToggleBenchmark={() => setBenchmarkOpen((open) => !open)}
        onToggleLayer={toggleSharedLayer}
        onSelectSource={selectVectorSource}
        onTogglePng={togglePngLayer}
      />
      <section className="map-comparison" aria-label="Map comparison">
        <article className="map-card">
          <h2 className="map-title">Tiled · {vectorSource === "pmtiles" ? "PMTiles" : "MBTiles"}</h2>
          <div className="map-frame">
            <MapView
              mapRef={tiledMapRef}
              variant="tiled"
              benchmarkRun={runId}
              onMapReady={onTiledReady}
            />
          </div>
        </article>
        <article className="map-card">
          <h2 className="map-title">Raw · GeoJSON</h2>
          <div className="map-frame">
            <MapView
              mapRef={rawMapRef}
              variant="raw"
              benchmarkRun={runId}
              onMapReady={onRawReady}
            />
          </div>
        </article>
      </section>
      {benchmarkOpen && (benchmark || running || error || runs.length > 0) && (
        <BenchmarkPanel
          benchmark={benchmark ?? EMPTY_BENCHMARK}
          rawLoading={rawLoading}
          rawError={rawError}
          runs={runs}
          running={running}
          runError={error}
          onClear={clearRuns}
        />
      )}
    </main>
  );
}
export default App;
