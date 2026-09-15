/**
 * Google Maps configuration and metro presets for AI Reality Agent.
 * Standard map styling ensures clear visibility of geographic outlines, roads, and borders.
 */

export const GOOGLE_MAP_DARK_STYLES = [];

export const PRESET_METROS = [
  { label: "Vijayawada, India", latitude: 16.5062, longitude: 80.648 },
  { label: "Austin, TX", latitude: 30.2672, longitude: -97.7431 },
  { label: "Denver, CO", latitude: 39.7392, longitude: -104.9903 },
  { label: "Seattle, WA", latitude: 47.6062, longitude: -122.3321 },
  { label: "San Francisco, CA", latitude: 37.7749, longitude: -122.4194 },
  { label: "New York, NY", latitude: 40.7128, longitude: -74.006 },
  { label: "Chicago, IL", latitude: 41.8781, longitude: -87.6298 },
  { label: "London, UK", latitude: 51.5074, longitude: -0.1278 },
];

export const DEFAULT_INVESTIGATION_RADIUS_METERS = 3000; // Exactly 3 km

export const DEFAULT_MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  gestureHandling: "greedy",
};

