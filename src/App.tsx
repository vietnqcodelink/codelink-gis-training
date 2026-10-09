import { useRef, useState } from "react";
import type { Map } from "maplibre-gl";
import type { CSSProperties } from "react";
import "./App.css";
import { BenchmarkPanel } from "./components/BenchmarkPanel";
import { MapView } from "./components/MapView";
import { LAYERS } from "./config";
import { useBenchmark } from "./hooks/useBenchmark";
import { useRawLayers } from "./hooks/useRawLayers";
import type { ComparisonKind, LayerId } from "./types";

function App() {
  const mapRef = useRef<Map | null>(null);
  const [mapLoadStart, setMapLoadStart] = useState<number | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Record<LayerId, boolean>>({ roads: true, hcm: true, wards: true });
  const [comparisonLayers, setComparisonLayers] = useState<Record<ComparisonKind, boolean>>({
    mbtiles: false,
    png: false,
  });
  const { benchmark, setBenchmark, refresh, readResources } = useBenchmark(mapLoadStart);
  const { rawLayers, rawLoading, rawError, toggle: toggleRawLayer } = useRawLayers(mapRef, setBenchmark);

  function toggleLayer(layer: (typeof LAYERS)[number]) {
    const visible = !visibleLayers[layer.id];
    layer.mapLayerIds.forEach((id) =>
      mapRef.current?.setLayoutProperty(id, "visibility", visible ? "visible" : "none")
    );
    setVisibleLayers((current) => ({ ...current, [layer.id]: visible }));
  }

  function toggleComparisonLayer(kind: ComparisonKind) {
    const ids = kind === "mbtiles" ? ["mbtiles-roads"] : ["png-roads-layer", "png-wards-layer"];
    const nextVisible = !comparisonLayers[kind];
    ids.forEach((id) => mapRef.current?.setLayoutProperty(id, "visibility", nextVisible ? "visible" : "none"));
    if (nextVisible && kind === "mbtiles" && (mapRef.current?.getZoom() ?? 0) < 12)
      mapRef.current?.easeTo({ zoom: 12, duration: 500 });
    setComparisonLayers((current) => ({ ...current, [kind]: nextVisible }));
  }

  return (
    <div className="map-shell">
      {benchmark && <BenchmarkPanel benchmark={benchmark} rawLoading={rawLoading} rawError={rawError} />}
      <MapView
        mapRef={mapRef}
        setMapLoadStart={setMapLoadStart}
        refresh={refresh}
        readResources={readResources}
        setBenchmark={setBenchmark}
      />
      <aside className="layer-panel" aria-label="Map layers">
        <h1>Layers</h1>
        <div className="layer-list">
          {LAYERS.map((layer) => (
            <button
              className="layer-row"
              key={layer.id}
              onClick={() => toggleLayer(layer)}
              aria-pressed={visibleLayers[layer.id]}>
              <span className="layer-icon" style={{ "--layer-color": layer.color } as CSSProperties} />
              <span className="layer-copy">
                <strong>{layer.label}</strong>
              </span>
              <span className={`switch ${visibleLayers[layer.id] ? "switch--on" : ""}`} aria-hidden="true">
                <span />
              </span>
            </button>
          ))}
        </div>
        <h2 className="layer-section-title">Raw comparison</h2>
        <div className="layer-list">
          <button
            className="raw-load-button"
            disabled={rawLoading !== null}
            aria-busy={rawLoading === "merged roads + wards"}
            onClick={() => toggleRawLayer("roads")}>
            {rawLoading === "merged roads + wards"
              ? "Loading merged GeoJSON…"
              : rawLayers.roads
              ? "Hide merged GeoJSON"
              : "Load merged GeoJSON (roads + wards)"}
          </button>
          <button
            className="raw-load-button"
            disabled={rawLoading !== null}
            aria-busy={rawLoading === "wards"}
            onClick={() => toggleRawLayer("wards")}>
            {rawLayers.wards ? "Hide raw wards" : "Load raw wards GeoJSON"}
          </button>
          <button className="raw-load-button" onClick={() => toggleComparisonLayer("mbtiles")}>
            {comparisonLayers.mbtiles ? "Hide MBTiles roads" : "Load MBTiles roads"}
          </button>
          <button className="raw-load-button" onClick={() => toggleComparisonLayer("png")}>
            {comparisonLayers.png ? "Hide PNG folder tiles" : "Load PNG folder tiles"}
          </button>
        </div>
      </aside>
    </div>
  );
}
export default App;
