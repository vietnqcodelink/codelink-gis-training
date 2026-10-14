import type { FilterSpecification, LineLayerSpecification, Map } from "maplibre-gl";

export const ROAD_GROUPS = [
  {
    id: "major",
    minzoom: 12,
    classes: ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"],
    width: 1.35,
  },
  {
    id: "collector",
    minzoom: 13,
    classes: ["tertiary", "tertiary_link", "unclassified", "road", "busway", "raceway"],
    width: 1.1,
  },
  {
    id: "local",
    minzoom: 14,
    classes: ["residential", "residential_link", "living_street"],
    width: 0.9,
  },
  {
    id: "access",
    minzoom: 15,
    classes: ["service", "services", "rest_area", "track", "footway", "cycleway", "path", "pedestrian", "steps", "construction", "proposed", "corridor", "elevator", "platform"],
    width: 0.7,
  },
] as const;

export function roadLayerIds(prefix: string) {
  return ROAD_GROUPS.map(({ id }) => `${prefix}-${id}`);
}

type RoadLayerOptions = {
  source: string;
  prefix: string;
  sourceLayer?: string;
  visibility?: "visible" | "none";
  filter?: FilterSpecification;
  color: string;
};

export function addRoadLayers(map: Map, options: RoadLayerOptions) {
  const { source, prefix, sourceLayer, visibility = "visible", filter, color } = options;
  ROAD_GROUPS.forEach(({ id, minzoom, classes, width }) => {
    const layer: LineLayerSpecification = {
      id: `${prefix}-${id}`,
      type: "line" as const,
      source,
      minzoom,
      ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
      filter: [
        "all",
        ["in", ["get", "highway"], ["literal", [...classes]]],
        ...(filter ? [filter] : []),
      ] as FilterSpecification,
      layout: { visibility },
      paint: {
        "line-color": color,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, width, 16, width * 2.5],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 16, 1],
      },
    };
    map.addLayer(layer);
  });
}
