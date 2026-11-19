// The map of the weather-place dialog (Leaflet, OpenStreetMap tiles). Loaded with import() on the first click,
// so neither Leaflet nor a tile is requested before the user opens the dialog.
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Raster tiles: no key or account. Another provider is another URL template and attribution. */
const TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};
/** Poland, shown when there is no remembered place and no browser location */
const POLAND: L.LatLngBoundsExpression = [
  [49.0, 14.1],
  [54.9, 24.2],
];
/** zoom on a browser location or a remembered place, and on a search result */
const PLACE_ZOOM = 10;
const SEARCH_ZOOM = 11;

export interface Point {
  lat: number;
  lon: number;
}

export interface MapPicker {
  /** Centres on the browser location and puts the pin there, unless the user has placed the pin already. */
  locate(p: Point): void;
  /** Pans and zooms to a search result; the pin stays where it is. */
  show(p: Point): void;
  /** Places or moves the pin to the map centre (the keyboard path). */
  pinAtCentre(): void;
  remove(): void;
}

/**
 * A map in `container` that opens on `start` with the pin on it, or on Poland without a pin.
 * `onPin` gets every new pin position: a map click, a dragged pin, the centre button or a location.
 */
export function createMapPicker(
  container: HTMLElement,
  start: Point | null,
  onPin: (p: Point) => void,
): MapPicker {
  const map = L.map(container, { keyboard: true });
  L.tileLayer(TILES.url, { maxZoom: TILES.maxZoom, attribution: TILES.attribution }).addTo(map);
  let marker: L.Marker | null = null;
  let placedByUser = false;

  const put = (at: L.LatLng): void => {
    const p = at.wrap();
    if (marker) marker.setLatLng(p);
    else {
      // a CSS pin: Leaflet's marker images do not resolve under a bundler, and CSS follows the theme
      // a 20 px square turned by 45°: its tip is 10√2 ≈ 14 px below the centre
      const icon = L.divIcon({ className: 'wx-marker', iconSize: [20, 20], iconAnchor: [10, 24] });
      // out of the tab order: the centre button moves the pin from the keyboard
      marker = L.marker(p, { icon, draggable: true, keyboard: false }).addTo(map);
      marker.on('dragend', () => {
        placedByUser = true;
        const q = marker!.getLatLng().wrap();
        onPin({ lat: q.lat, lon: q.lng });
      });
    }
    onPin({ lat: p.lat, lon: p.lng });
  };

  if (start) {
    map.setView([start.lat, start.lon], PLACE_ZOOM);
    put(L.latLng(start.lat, start.lon));
  } else {
    map.fitBounds(POLAND);
  }
  map.on('click', (e: L.LeafletMouseEvent) => {
    placedByUser = true;
    put(e.latlng);
  });

  return {
    locate(p) {
      if (placedByUser) return;
      map.setView([p.lat, p.lon], PLACE_ZOOM);
      put(L.latLng(p.lat, p.lon));
    },
    show(p) {
      map.setView([p.lat, p.lon], SEARCH_ZOOM);
    },
    pinAtCentre() {
      placedByUser = true;
      put(map.getCenter());
    },
    remove() {
      map.remove();
    },
  };
}
