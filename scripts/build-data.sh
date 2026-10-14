#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PBF_PATH="$ROOT_DIR/vietnam.osm.pbf"
PBF_URL="https://download.geofabrik.de/asia/vietnam-latest.osm.pbf"
RELATION_ID="${HCM_RELATION_ID:-1973756}"
BUILD_PNG=0
DOWNLOAD_PBF=0

usage() {
  cat <<'USAGE'
Usage: ./scripts/build-data.sh [options]

Build the boundary, Raw GeoJSON and PMTiles assets from vietnam.osm.pbf.

Options:
  --download  Download Geofabrik's current Vietnam extract if the PBF is missing.
  --png       Also build and copy PNG raster tiles.
  -h, --help  Show this help.

Set HCM_RELATION_ID to override the default OSM relation ID (1973756).
USAGE
}

while (($#)); do
  case "$1" in
    --download) DOWNLOAD_PBF=1 ;;
    --png) BUILD_PNG=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [[ ! "$RELATION_ID" =~ ^[0-9]+$ ]]; then
  echo "HCM_RELATION_ID must contain only digits." >&2
  exit 2
fi

required_commands=(osmium ogr2ogr tippecanoe tile-join pmtiles jq npm)
if ((BUILD_PNG)); then
  required_commands+=(gdal_rasterize gdaldem gdal2tiles.py)
fi

missing_commands=()
for command_name in "${required_commands[@]}"; do
  command -v "$command_name" >/dev/null || missing_commands+=("$command_name")
done
if ((${#missing_commands[@]})); then
  printf 'Missing required commands: %s\n' "${missing_commands[*]}" >&2
  echo "Install the tools listed in README.md, then run this script again." >&2
  exit 1
fi

if [[ ! -f "$PBF_PATH" ]]; then
  if ((DOWNLOAD_PBF)); then
    command -v curl >/dev/null || { echo "Required command not found: curl" >&2; exit 1; }
    echo "Downloading the latest Vietnam OSM extract to $PBF_PATH"
    curl -fL "$PBF_URL" -o "$PBF_PATH"
  else
    echo "Missing source file: $PBF_PATH" >&2
    echo "Download it from $PBF_URL, or rerun with --download." >&2
    exit 1
  fi
fi

cd "$ROOT_DIR"
mkdir -p out/hcm/build public

echo "Extracting HCM boundary relation $RELATION_ID"
rm -f out/hcm/hcm-boundary.osm.pbf out/hcm/hcm-boundary.geojson public/hcm.geojson
if ! osmium getid vietnam.osm.pbf "r$RELATION_ID" -r -o out/hcm/hcm-boundary.osm.pbf; then
  echo "Could not extract relation $RELATION_ID. Check HCM_RELATION_ID for this PBF snapshot." >&2
  echo "Level-4 relations can be inspected with: osmium tags-filter vietnam.osm.pbf r/boundary=administrative -o out/hcm/admin.osm.pbf" >&2
  exit 1
fi

ogr2ogr -f GeoJSON out/hcm/hcm-boundary.geojson \
  out/hcm/hcm-boundary.osm.pbf multipolygons \
  -where "name='Thành phố Hồ Chí Minh' AND admin_level='4'"
if ! jq -e '.features | length == 1' out/hcm/hcm-boundary.geojson >/dev/null; then
  echo "Expected one HCM boundary feature; inspect out/hcm/hcm-boundary.geojson." >&2
  exit 1
fi
ogrinfo -so -al out/hcm/hcm-boundary.geojson
cp out/hcm/hcm-boundary.geojson public/hcm.geojson

echo "Extracting roads and ward boundaries"
rm -f out/hcm/build/roads.geojson out/hcm/build/wards.geojson
ogr2ogr -f GeoJSON out/hcm/build/roads.geojson vietnam.osm.pbf lines \
  -clipsrc public/hcm.geojson \
  -where "highway IS NOT NULL" \
  -select osm_id,name,highway,z_order,other_tags

ogr2ogr -f GeoJSON out/hcm/build/wards.geojson \
  vietnam.osm.pbf multipolygons \
  -clipsrc public/hcm.geojson \
  -where "boundary = 'administrative' AND admin_level = '6'" \
  -select osm_id,name,admin_level,boundary,type

for layer_file in out/hcm/build/roads.geojson out/hcm/build/wards.geojson; do
  if ! jq -e '.features | length > 0' "$layer_file" >/dev/null; then
    echo "No features found in $layer_file; check the source snapshot and filters." >&2
    exit 1
  fi
done

ogrinfo -so -al out/hcm/build/roads.geojson
ogrinfo -so -al out/hcm/build/wards.geojson
cp out/hcm/build/roads.geojson out/hcm/hcm-roads.geojson
cp out/hcm/build/wards.geojson out/hcm/hcm-wards.geojson

echo "Creating merged Raw GeoJSON"
rm -f public/hcm-road-wards.geojson
jq -s '{type:"FeatureCollection", name:"hcm-road-wards", crs:{type:"name",properties:{name:"urn:ogc:def:crs:OGC:1.3:CRS84"}}, features: ((.[0].features | map(.properties = ((.properties // {}) + {dataset:"roads"}))) + (.[1].features | map(.properties = ((.properties // {}) + {dataset:"wards"}))))}' \
  out/hcm/build/roads.geojson out/hcm/build/wards.geojson \
  > public/hcm-road-wards.geojson

echo "Building vector tiles and PMTiles"
rm -f out/hcm/roads-layer.mbtiles out/hcm/wards-layer.mbtiles \
  out/hcm/hcm-road-wards.mbtiles public/hcm-road-wards.pmtiles
tippecanoe -o out/hcm/roads-layer.mbtiles \
  -Z12 -z16 --read-parallel --drop-densest-as-needed \
  --simplification=10 --simplification-at-maximum-zoom=1 \
  --single-precision -l roads out/hcm/build/roads.geojson

tippecanoe -o out/hcm/wards-layer.mbtiles \
  -Z10 -z16 --read-parallel --drop-densest-as-needed \
  --simplification=4 --simplification-at-maximum-zoom=1 \
  --single-precision -l wards out/hcm/build/wards.geojson

tile-join -o out/hcm/hcm-road-wards.mbtiles \
  out/hcm/wards-layer.mbtiles out/hcm/roads-layer.mbtiles
pmtiles convert out/hcm/hcm-road-wards.mbtiles public/hcm-road-wards.pmtiles
pmtiles verify public/hcm-road-wards.pmtiles

if ((BUILD_PNG)); then
  echo "Building optional PNG raster tiles"
  mkdir -p public/raster-roads public/raster-wards
  rm -rf out/raster-tiles-roads out/raster-tiles-wards
  find public/raster-roads public/raster-wards -type f -name '*.png' -delete
  printf '0 0 0 0 0\n255 37 99 235 255\n' > out/raster-roads-colors.txt
  printf '0 0 0 0 0\n255 219 39 119 255\n' > out/raster-wards-colors.txt

  gdal_rasterize -burn 255 -init 0 -a_nodata 0 -ot Byte \
    -te 106.0 8.5 107.65 11.58 -tr 0.0005 0.0005 \
    -co COMPRESS=LZW -of GTiff \
    out/hcm/hcm-roads.geojson out/raster-roads.tif
  gdal_rasterize -burn 255 -init 0 -a_nodata 0 -ot Byte \
    -te 106.0 8.5 107.65 11.58 -tr 0.0005 0.0005 \
    -co COMPRESS=LZW -of GTiff \
    out/hcm/hcm-wards.geojson out/raster-wards.tif

  gdaldem color-relief out/raster-roads.tif out/raster-roads-colors.txt \
    out/raster-roads-color.tif -alpha
  gdaldem color-relief out/raster-wards.tif out/raster-wards-colors.txt \
    out/raster-wards-color.tif -alpha
  gdal2tiles.py --xyz -z 8-12 --processes=2 \
    out/raster-roads-color.tif out/raster-tiles-roads
  gdal2tiles.py --xyz -z 8-12 --processes=2 \
    out/raster-wards-color.tif out/raster-tiles-wards
  cp -R out/raster-tiles-roads/. public/raster-roads/
  cp -R out/raster-tiles-wards/. public/raster-wards/
else
  rm -rf public/raster-roads public/raster-wards
fi

echo "Writing snapshot and artifact checksums"
npm run data:manifest
echo "Data build complete. Run 'npm run dev' to start the app."
