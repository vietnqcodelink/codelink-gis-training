import type { RawKind } from "../types";

export const RAW_URLS: Record<RawKind, string> = {
  roads: "/hcm-road-wards.geojson",
  wards: "/hcm-admin-wards.geojson",
};

export async function fetchRawGeoJson(kind: RawKind, signal?: AbortSignal) {
  const downloadStart = performance.now();
  const response = await fetch(RAW_URLS[kind], { cache: "no-store", signal });
  if (!response.ok) throw new Error(`${RAW_URLS[kind]} returned HTTP ${response.status}`);
  const payload = await response.arrayBuffer();
  const downloadMs = performance.now() - downloadStart;
  const parseStart = performance.now();
  const data = JSON.parse(new TextDecoder().decode(payload));
  return { data, bytes: payload.byteLength, downloadMs, parseMs: performance.now() - parseStart };
}
