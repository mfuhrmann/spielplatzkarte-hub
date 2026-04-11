// Runtime configuration — read from window.HUB_CONFIG written by config.js (docker-entrypoint.sh).
// Falls back to development defaults when running outside Docker.

const cfg = window.HUB_CONFIG || {};

export const registryUrl  = cfg.REGISTRY_URL  || './registry.json';
export const mapZoom      = Number(cfg.MAP_ZOOM      ?? 5);
export const mapMinZoom   = Number(cfg.MAP_MIN_ZOOM  ?? 4);
export const mapCenter    = cfg.MAP_CENTER ? cfg.MAP_CENTER.split(',').map(Number) : [10.5, 51.2]; // lon, lat
