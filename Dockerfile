FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_MBTILES_TILE_URL=https://gis-api.vioralabs.site/data/hcm-road-wards/{z}/{x}/{y}.pbf
ENV VITE_MBTILES_TILE_URL=$VITE_MBTILES_TILE_URL
ARG APP_COMMIT_SHA
ENV APP_COMMIT_SHA=$APP_COMMIT_SHA
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80
