// Loads and validates the instance registry.
// Registry format: array of { name, url, bbox? }
// bbox is [minLon, minLat, maxLon, maxLat] in WGS84 — used for map hints, not filtering.

import { registryUrl } from './config.js';

let _registry = null;

export async function loadRegistry() {
    if (_registry) return _registry;
    const res = await fetch(registryUrl);
    if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);
    const data = await res.json();
    _registry = data.filter(entry => entry.url && entry.name);
    return _registry;
}

// Fetch the app version from /version.json served by the instance.
export async function fetchInstanceVersion(instance) {
    const url = `${instance.url.replace(/\/$/, '')}/version.json`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.version ?? null;
    } catch {
        return null;
    }
}

// Fetch instance metadata (name, playground_count, bbox) from get_meta.
// Falls back gracefully — name from registry is used if meta is unavailable.
export async function fetchInstanceMeta(instance) {
    const url = `${instance.url.replace(/\/$/, '')}/api/rpc/get_meta`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// Fetch playground GeoJSON from a single instance.
// Returns { instance, geojson } or null on failure.
export async function fetchInstancePlaygrounds(instance) {
    const url = `${instance.url.replace(/\/$/, '')}/api/rpc/get_playgrounds`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const geojson = await res.json();
        return { instance, geojson };
    } catch (e) {
        console.warn(`[hub] Could not load ${instance.name} (${url}):`, e.message);
        return null;
    }
}

// Fetch playground data from all registered instances in parallel.
// Returns array of { instance, geojson } for successful responses only.
export async function fetchAllPlaygrounds(registry) {
    const results = await Promise.all(registry.map(fetchInstancePlaygrounds));
    return results.filter(Boolean);
}
