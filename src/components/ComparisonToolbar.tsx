type SharedLayer = "roads" | "wards" | "boundary";
type VectorSource = "pmtiles" | "mbtiles";

type Props = {
  benchmarkOpen: boolean;
  benchmarkRunning: boolean;
  rawLoading: string | null;
  layerVisibility: Record<SharedLayer, boolean>;
  vectorSource: VectorSource;
  pngVisible: boolean;
  onToggleBenchmark: () => void;
  onToggleLayer: (layer: SharedLayer) => void;
  onSelectSource: (source: VectorSource) => void;
  onTogglePng: () => void;
};

const LAYERS: SharedLayer[] = ["roads", "wards", "boundary"];
const SOURCES: VectorSource[] = ["pmtiles", "mbtiles"];

export function ComparisonToolbar({
  benchmarkOpen,
  benchmarkRunning,
  rawLoading,
  layerVisibility,
  vectorSource,
  pngVisible,
  onToggleBenchmark,
  onToggleLayer,
  onSelectSource,
  onTogglePng,
}: Props) {
  return (
    <header className="comparison-header">
      <div className="shared-controls" role="group" aria-label="Shared layer controls">
        {LAYERS.map((layer) => (
          <button
            key={layer}
            className={`layer-toggle ${layerVisibility[layer] ? "is-on" : ""}`}
            aria-pressed={layerVisibility[layer]}
            disabled={benchmarkRunning || (layer !== "boundary" && rawLoading !== null)}
            onClick={() => onToggleLayer(layer)}>
            {layer === "boundary" ? "Boundary" : layer === "roads" ? "Roads" : "Wards"}
          </button>
        ))}
      </div>
      <div className="source-controls" role="group" aria-label="Vector tile source">
        {SOURCES.map((source) => (
          <button
            key={source}
            className={`layer-toggle source-toggle ${vectorSource === source ? "is-on" : ""}`}
            aria-pressed={vectorSource === source}
            disabled={benchmarkRunning}
            onClick={() => onSelectSource(source)}>
            {source === "pmtiles" ? "PMTiles" : "MBTiles"}
          </button>
        ))}
      </div>
      <button
        className={`layer-toggle source-toggle ${pngVisible ? "is-on" : ""}`}
        aria-pressed={pngVisible}
        disabled={benchmarkRunning}
        onClick={onTogglePng}>
        PNG
      </button>
      <div className="comparison-actions">
        <button className="toolbar-button" aria-expanded={benchmarkOpen} onClick={onToggleBenchmark}>
          Benchmark: {benchmarkOpen ? "ON" : "OFF"}
        </button>
      </div>
    </header>
  );
}
