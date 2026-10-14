import { useState } from "react";
import "./App.css";
import { BenchmarkPanel } from "./components/BenchmarkPanel";
import { BuildVersion } from "./components/BuildVersion";
import { ComparisonMaps } from "./components/ComparisonMaps";
import { ComparisonToolbar } from "./components/ComparisonToolbar";
import { useBenchmarkSession } from "./hooks/useBenchmarkSession";
import { useComparisonLayers } from "./hooks/useComparisonLayers";

const EMPTY_BENCHMARK = { requests: [] };

function App() {
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const {
    tiledMapRef, rawMapRef, runId, onTiledReady, onRawReady,
    benchmark, rawLoading, rawError, runs, running, error,
    clearRuns, rawLayers, toggleRawLayer,
  } = useBenchmarkSession();
  const layers = useComparisonLayers(tiledMapRef, rawMapRef, rawLayers, toggleRawLayer);

  return (
    <main className="benchmark-app">
      <BuildVersion />
      <ComparisonToolbar
        benchmarkOpen={benchmarkOpen}
        benchmarkRunning={running}
        rawLoading={rawLoading}
        layerVisibility={layers.layerVisibility}
        vectorSource={layers.vectorSource}
        pngVisible={layers.pngVisible}
        onToggleBenchmark={() => setBenchmarkOpen((open) => !open)}
        onToggleLayer={layers.toggleLayer}
        onSelectSource={layers.selectVectorSource}
        onTogglePng={layers.togglePng}
      />
      <ComparisonMaps
        tiledMapRef={tiledMapRef}
        rawMapRef={rawMapRef}
        runId={runId}
        vectorSource={layers.vectorSource}
        onTiledReady={onTiledReady}
        onRawReady={onRawReady}
      />
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
