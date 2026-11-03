import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { labelOf, SHAPES } from './sighting.js';

let map = null;
let you = null;
let accuracyCircle = null;
let markers = null;

const youStyle = {
  radius: 7,
  color: '#7eb6c9',
  weight: 2,
  fillColor: '#7eb6c9',
  fillOpacity: 1,
};

export function mountMap(container, { position, sightings, onSelect }) {
  destroyMap();
  const points = [];
  for (const sighting of sightings) {
    if (Number.isFinite(sighting.lat) && Number.isFinite(sighting.lon)) {
      points.push([sighting.lat, sighting.lon]);
    }
  }
  if (position && Number.isFinite(position.lat) && Number.isFinite(position.lon)) {
    points.push([position.lat, position.lon]);
  }
  const center = points[0] || [51.16, 10.45];
  map = L.map(container, { zoomControl: true, center, zoom: points.length ? 14 : 6 });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);
  placeYou(position);
  markers = L.layerGroup().addTo(map);
  for (const sighting of sightings) {
    if (!Number.isFinite(sighting.lat) || !Number.isFinite(sighting.lon)) continue;
    const marker = L.circleMarker([sighting.lat, sighting.lon], {
      radius: 8,
      color: '#e2a45c',
      weight: 2,
      fillColor: '#e2a45c',
      fillOpacity: 0.9,
    });
    const title = sighting.described ? labelOf(SHAPES, sighting.shape) : 'Nur Zeitpunkt';
    marker.bindTooltip(title, { direction: 'top', opacity: 0.95 });
    marker.on('click', () => onSelect(sighting.id));
    marker.addTo(markers);
  }
  if (points.length > 1) {
    const bounds = L.latLngBounds(points);
    const spread = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
    if (spread > 40) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }
  requestAnimationFrame(() => map?.invalidateSize());
}

export function placeYou(position) {
  if (!map || !position || !Number.isFinite(position.lat)) return;
  const ll = [position.lat, position.lon];
  if (!you) you = L.circleMarker(ll, youStyle).addTo(map);
  else you.setLatLng(ll);
  if (Number.isFinite(position.accuracy)) {
    if (!accuracyCircle) {
      accuracyCircle = L.circle(ll, {
        radius: position.accuracy,
        color: '#7eb6c9',
        weight: 1,
        fillColor: '#7eb6c9',
        fillOpacity: 0.08,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(ll);
      accuracyCircle.setRadius(position.accuracy);
    }
  }
}

export function destroyMap() {
  if (map) map.remove();
  map = null;
  you = null;
  accuracyCircle = null;
  markers = null;
}
