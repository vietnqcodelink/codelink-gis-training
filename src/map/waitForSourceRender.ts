import type { Map } from "maplibre-gl";

export function waitForSourceRender(
  map: Map,
  sourceIds: string[],
  startedAt: number,
  extraReady: () => boolean = () => true
) {
  return new Promise<number>((resolve, reject) => {
    let timeout = 0;
    let repaintRequested = false;
    const sourcesReady = () =>
      extraReady() && map.isStyleLoaded() && sourceIds.every((id) => map.getSource(id) && map.isSourceLoaded(id));
    const cleanup = () => {
      window.clearTimeout(timeout);
      map.off("render", onRender);
      map.off("sourcedata", check);
      map.off("styledata", check);
      map.off("remove", onRemove);
    };
    const check = () => {
      if (!sourcesReady() || repaintRequested) return;
      repaintRequested = true;
      map.triggerRepaint();
    };
    const onRender = () => {
      repaintRequested = false;
      if (!sourcesReady()) {
        check();
        return;
      }
      cleanup();
      resolve(performance.now() - startedAt);
    };
    const onRemove = () => {
      cleanup();
      reject(new Error("Map was removed before its data rendered."));
    };

    map.on("render", onRender);
    map.on("sourcedata", check);
    map.on("styledata", check);
    map.on("remove", onRemove);
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for map sources: ${sourceIds.join(", ")}`));
    }, 120_000);
    check();
  });
}
