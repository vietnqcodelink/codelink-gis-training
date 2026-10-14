import type { Map } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { MapView } from "./MapView";

type Props = {
  tiledMapRef: MutableRefObject<Map | null>;
  rawMapRef: MutableRefObject<Map | null>;
  runId: string;
  vectorSource: "pmtiles" | "mbtiles";
  onTiledReady: (map: Map) => void;
  onRawReady: (map: Map) => void;
};

export function ComparisonMaps({
  tiledMapRef,
  rawMapRef,
  runId,
  vectorSource,
  onTiledReady,
  onRawReady,
}: Props) {
  return (
    <section className="map-comparison" aria-label="Map comparison">
      <article className="map-card">
        <h2 className="map-title">Tiled · {vectorSource === "pmtiles" ? "PMTiles" : "MBTiles"}</h2>
        <div className="map-frame">
          <MapView mapRef={tiledMapRef} variant="tiled" benchmarkRun={runId} onMapReady={onTiledReady} />
        </div>
      </article>
      <article className="map-card">
        <h2 className="map-title">Raw · GeoJSON</h2>
        <div className="map-frame">
          <MapView mapRef={rawMapRef} variant="raw" benchmarkRun={runId} onMapReady={onRawReady} />
        </div>
      </article>
    </section>
  );
}
