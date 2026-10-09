# GIS Training: Ho Chi Minh City map

This project compares four ways to deliver the same GIS data in MapLibre:

1. Raw GeoJSON
2. PMTiles
3. MBTiles through TileServer GL
4. Folder-based PNG raster tiles

The pipeline below starts with `vietnam.osm.pbf` and produces every artifact used by the frontend.

## 1. Prerequisites

From the repository root:

```bash
brew install gdal osmium-tool tippecanoe jq sqlite3
node --version
python3 --version
ogr2ogr --version
tippecanoe --version
pmtiles --version
```

The source extract must be at:

```text
./vietnam.osm.pbf
```

Install the frontend dependencies:

```bash
cd maplibre
npm install
cd ..
```

## 2. Extract the HCM boundary from `vietnam.osm.pbf`

The source file in this project is an OSM PBF file, not a PDF:

```text
vietnam.osm.pbf
```

First keep only administrative boundary relations, then export the HCM relation and its dependencies. The known HCM relation in this extract is `1973756`. Level 4 = City:

```bash
osmium tags-filter vietnam.osm.pbf \
  r/boundary=administrative \
  -o out/hcm/admin.osm.pbf

osmium tags-filter out/hcm/admin.osm.pbf \
  r/admin_level=4 \
  -f osm \
  > out/hcm/admin-level4.osm

grep -n 'name" v="Thành phố Hồ Chí Minh"' out/hcm/admin-level4.osm

osmium getid vietnam.osm.pbf \
  r1973756 \
  -r \
  -o out/hcm/hcm-boundary.osm.pbf
```

`-r` (recursive / relation) is required because a relation depends on ways and nodes. The node named HCM is only a point; the actual boundary is the administrative relation with `boundary=administrative`, `type=boundary` and `admin_level=4`.

Inspect the extracted OSM layers and select the multipolygon layer:

```bash
osmium fileinfo -e out/hcm/hcm-boundary.osm.pbf
ogrinfo out/hcm/hcm-boundary.osm.pbf
ogrinfo out/hcm/hcm-boundary.osm.pbf multipolygons -geom=NO
```

Export the exact HCM feature to GeoJSON:

```bash
ogr2ogr \
  -f GeoJSON \
  out/hcm/hcm-boundary.geojson \
  out/hcm/hcm-boundary.osm.pbf \
  multipolygons \
  -where "name='Thành phố Hồ Chí Minh' AND admin_level='4'"
```

Validate that it is one multipolygon and inspect its real extent:

```bash
ogrinfo out/hcm/hcm-boundary.geojson
ogrinfo -so -al out/hcm/hcm-boundary.geojson
```

Copy this extracted boundary to the frontend public directory. It is then used by `ogr2ogr -clipsrc` when extracting roads:

```bash
cp out/hcm/hcm-boundary.geojson maplibre/public/hcm.geojson
```

## 3. Validate the boundary and ward source

The boundary file used by the rest of the pipeline is now:

```text
maplibre/public/hcm.geojson
```

It is a GeoJSON polygon/multipolygon in WGS84 longitude/latitude. Check its extent:

```bash
ogrinfo -so -al maplibre/public/hcm.geojson
```

If the relation ID differs in another Vietnam extract, find it again by inspecting the level-4 administrative XML:

```bash
osmium tags-filter vietnam.osm.pbf \
  r/boundary=administrative \
  -o out/hcm/admin.osm.pbf
osmium tags-filter out/hcm/admin.osm.pbf \
  r/admin_level=4 -f osm \
  > out/hcm/admin-level4.osm
grep -n 'name" v="Thành phố Hồ Chí Minh"' out/hcm/admin-level4.osm
```

The exact relation ID and name fields can differ by extract. Do not continue until `ogrinfo` confirms that `hcm.geojson` contains one intended HCM multipolygon.

The ward boundaries are extracted from the same `vietnam.osm.pbf` file in the
next section. The older prepared file, if present, can still be used as an
input for comparison:

```text
maplibre/public/hcm-admin-wards.geojson
```

## 4. Extract roads from OSM PBF

Create the working directories:

```bash
mkdir -p out/hcm/build
```

Extract all OSM line features clipped to HCM, then keep only features with a `highway` tag:

```bash
ogr2ogr -f GeoJSON out/hcm/build/roads.geojson vietnam.osm.pbf lines \
  -clipsrc maplibre/public/hcm.geojson \
  -where "highway IS NOT NULL" \
  -select osm_id,name,highway,z_order,other_tags
```

Inspect the result:

```bash
ogrinfo -so -al out/hcm/build/roads.geojson
```

The prepared road input used by the rest of the project is also kept as:

```text
out/hcm/roads-hcm.geojson
```

If you want the clipped output under that canonical name, copy it after validating the generated file:

```bash
cp out/hcm/build/roads.geojson out/hcm/roads-hcm.geojson
```

## 5. Extract wards from OSM PBF

In OSM, Vietnamese wards are normally administrative boundaries with
`admin_level=6`. Export only those polygons that fall inside the HCM boundary.
The `-clipsrc` option uses the real HCM polygon rather than a rectangular
bounding box.

```bash
ogr2ogr -f GeoJSON out/hcm/build/wards-from-pbf.geojson \
  vietnam.osm.pbf multipolygons \
  -clipsrc maplibre/public/hcm.geojson \
  -where "boundary = 'administrative' AND admin_level = '6'" \
  -select osm_id,name,admin_level,boundary,type
```

Inspect the extracted wards and confirm that they are polygons/multipolygons:

```bash
ogrinfo -so -al out/hcm/build/wards-from-pbf.geojson
ogrinfo out/hcm/build/wards-from-pbf.geojson
```

If the result is empty, inspect the available administrative levels first:

```bash
ogrinfo vietnam.osm.pbf multipolygons -where "boundary = 'administrative'" -geom=NO
```

Some extracts store the administrative level as a numeric value. In that case,
use `admin_level = 6` instead of `admin_level = '6'`.

Use the PBF-derived file as the canonical ward input:

```bash
cp out/hcm/build/wards-from-pbf.geojson \
  maplibre/public/hcm-admin-wards.geojson
```

## 6. Prepare road and ward GeoJSON

Copy the administrative ward layer into the build directory and retain the fields needed by the map:

```bash
ogr2ogr -f GeoJSON out/hcm/build/wards.geojson \
  maplibre/public/hcm-admin-wards.geojson \
  -select osm_id,name,admin_level,boundary,type
```

Inspect it:

```bash
ogrinfo -so -al out/hcm/build/wards.geojson
```

Create the files used by the raw and PNG modes:

```bash
cp out/hcm/build/roads.geojson out/hcm/hcm-roads.geojson
cp out/hcm/build/wards.geojson out/hcm/hcm-wards.geojson
```

## 7. Create the merged raw GeoJSON

The merged file contains both datasets. The `dataset` property identifies whether a feature is a road or ward:

```bash
jq -s '{type:"FeatureCollection", name:"hcm-road-wards", crs:{type:"name",properties:{name:"urn:ogc:def:crs:OGC:1.3:CRS84"}}, features: ((.[0].features | map(.properties = ((.properties // {}) + {dataset:"roads"}))) + (.[1].features | map(.properties = ((.properties // {}) + {dataset:"wards"}))))}' \
  out/hcm/hcm-roads.geojson out/hcm/hcm-wards.geojson \
  > out/hcm/hcm-road-wards.geojson
```

Copy it to the frontend public directory for the raw GeoJSON option:

```bash
cp out/hcm/hcm-road-wards.geojson maplibre/public/hcm-road-wards.geojson
```

Check the feature counts:

```bash
ogrinfo -so -al out/hcm/hcm-road-wards.geojson
jq '.features | length' out/hcm/hcm-road-wards.geojson
```

## 8. Build vector MBTiles with Tippecanoe

Roads use zoom 12–16. Wards use zoom 10–16:

```bash
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
```

Inspect the SQLite tile database:

```bash
sqlite3 out/hcm/hcm-road-wards.mbtiles \
  "select zoom_level, count(*), max(length(tile_data)) from tiles group by zoom_level order by zoom_level;"
```

## 9. Convert MBTiles to PMTiles

PMTiles is the static archive used by the main map:

```bash
pmtiles convert out/hcm/hcm-road-wards.mbtiles \
  maplibre/public/hcm-road-wards.pmtiles

pmtiles verify maplibre/public/hcm-road-wards.pmtiles
pmtiles show maplibre/public/hcm-road-wards.pmtiles
```

The frontend opens it through:

```text
pmtiles:///hcm-road-wards.pmtiles
```

## 10. Build PNG folder tiles

PNG tiles are generated separately for roads and wards. The full extent is important: a smaller `-te` clips the image at the dataset edges.

```bash
mkdir -p out/raster-tiles-roads-full out/raster-tiles-wards-full

gdal_rasterize \
  -burn 255 -init 0 -a_nodata 0 -ot Byte \
  -te 106.0 8.5 107.65 11.58 -tr 0.0005 0.0005 \
  -co COMPRESS=LZW -of GTiff \
  out/hcm/hcm-roads.geojson out/raster-roads-full.tif

gdal_rasterize \
  -burn 255 -init 0 -a_nodata 0 -ot Byte \
  -te 106.0 8.5 107.65 11.58 -tr 0.0005 0.0005 \
  -co COMPRESS=LZW -of GTiff \
  out/hcm/hcm-wards.geojson out/raster-wards-full.tif

gdaldem color-relief out/raster-roads-full.tif out/raster-roads-colors.txt \
  out/raster-roads-full-color.tif -alpha
gdaldem color-relief out/raster-wards-full.tif out/raster-wards-colors.txt \
  out/raster-wards-full-color.tif -alpha

gdal2tiles.py --xyz -z 8-12 --processes=2 \
  out/raster-roads-full-color.tif out/raster-tiles-roads-full
gdal2tiles.py --xyz -z 8-12 --processes=2 \
  out/raster-wards-full-color.tif out/raster-tiles-wards-full
```

Copy the generated tiles into the frontend:

```bash
mkdir -p maplibre/public/raster-roads maplibre/public/raster-wards
cp -R out/raster-tiles-roads-full/. maplibre/public/raster-roads/
cp -R out/raster-tiles-wards-full/. maplibre/public/raster-wards/
```

The browser requests them as:

```text
/raster-roads/{z}/{x}/{y}.png
/raster-wards/{z}/{x}/{y}.png
```

## 11. Build and run the frontend

```bash
cd maplibre
npm run build
npm run lint
npx http-server dist -c-1
```

Open the URL printed by `http-server`. The frontend serves PMTiles, raw GeoJSON and PNG files statically.

## 12. Run TileServer GL for MBTiles

Start TileServer GL from another terminal at the repository root:

```bash
tileserver-gl out/hcm/hcm-road-wards.mbtiles
```

For local TileServer GL, set the frontend URL explicitly:

```text
http://127.0.0.1:8080/data/hcm-road-wards/{z}/{x}/{y}.pbf
```

If the server uses another URL, set it before building:

```bash
cd maplibre
VITE_MBTILES_TILE_URL="http://127.0.0.1:8080/data/hcm-road-wards/{z}/{x}/{y}.pbf" npm run build
```

## 13. Final output layout

```text
maplibre/public/
├── hcm.geojson                    # HCM clipping boundary
├── hcm-admin-wards.geojson        # raw ward source
├── hcm-road-wards.geojson         # merged raw roads + wards
├── hcm-road-wards.pmtiles         # static vector archive
├── raster-roads/{z}/{x}/{y}.png   # road raster tiles
└── raster-wards/{z}/{x}/{y}.png  # ward raster tiles

out/hcm/
├── hcm-road-wards.mbtiles         # MBTiles for TileServer GL
├── hcm-roads.geojson              # raster road input
├── hcm-wards.geojson              # raster ward input
└── hcm-road-wards.geojson         # merged build artifact
```

## 14. Validation commands

```bash
ogrinfo -so -al out/hcm/hcm-road-wards.geojson
pmtiles verify maplibre/public/hcm-road-wards.pmtiles
sqlite3 out/hcm/hcm-road-wards.mbtiles \
  "select max(length(tile_data)), sum(length(tile_data)), count(*) from tiles;"

cd maplibre
npm run build
npm run lint
```

## Performance meaning

| Mode        | What the browser loads                        | Main trade-off                                                |
| ----------- | --------------------------------------------- | ------------------------------------------------------------- |
| Raw GeoJSON | One large JSON file, then parses all features | Simple and editable, but high download/parse/render cost      |
| PMTiles     | Byte ranges from one static archive           | Efficient viewport transfer and static hosting                |
| MBTiles     | Individual PBF tiles from TileServer GL       | Good vector behavior, but needs a tile server                 |
| PNG folder  | Individual raster images                      | Simple rendering, but no feature properties or vector styling |

After changing source data, rebuild the downstream artifacts. A data update is not complete until the relevant GeoJSON, MBTiles/PMTiles and PNG outputs have been regenerated and copied into `maplibre/public/`.

## Production deployment

The production server uses these domains:

```text
https://gis-training.vioralabs.site  # static MapLibre web app
https://gis-api.vioralabs.site       # TileServer GL / MBTiles API
```

The canonical web Dockerfile is in the `maplibre/` directory:

```text
maplibre/Dockerfile
maplibre/nginx.conf
```
