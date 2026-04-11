import '../css/style.css';

import { Map, View } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import { fromLonLat } from 'ol/proj';
import Overlay from 'ol/Overlay.js';
import { Popover } from 'bootstrap';
import { defaults as defaultControls, ScaleLine } from 'ol/control.js';

import { mapZoom, mapMinZoom, mapCenter } from './config.js';
import { playgroundCompleteness } from './completeness.js';
import { loadRegistry, fetchInstancePlaygrounds, fetchInstanceMeta, fetchInstanceVersion } from './registry.js';
import { version } from '../package.json';

document.getElementById('app-version').textContent = version;

// ── Basemap ───────────────────────────────────────────────────────────────────

const basemap = new TileLayer({
    source: new XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attributions: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
    }),
});

// ── Playground styles ─────────────────────────────────────────────────────────

function makeHatchPattern(color, bgColor) {
    const size = 10;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(size, 0);
    ctx.stroke();
    return ctx.createPattern(canvas, 'repeat');
}

const _hatchComplete = makeHatchPattern('rgba(34,139,34,0.55)',  'rgba(34,139,34,0.08)');
const _hatchPartial  = makeHatchPattern('rgba(180,130,0,0.55)',  'rgba(234,179,8,0.08)');
const _hatchMissing  = makeHatchPattern('rgba(200,50,50,0.55)',  'rgba(239,68,68,0.06)');

const styles = {
    complete:      new Style({ fill: new Fill({ color: 'rgba(34,139,34,0.22)' }),  stroke: new Stroke({ color: '#155215', width: 1.5 }) }),
    partial:       new Style({ fill: new Fill({ color: 'rgba(234,179,8,0.22)' }),  stroke: new Stroke({ color: '#92400e', width: 1.5 }) }),
    missing:       new Style({ fill: new Fill({ color: 'rgba(239,68,68,0.18)' }),  stroke: new Stroke({ color: '#991b1b', width: 1.5 }) }),
    completeHatch: new Style({ fill: new Fill({ color: _hatchComplete }), stroke: new Stroke({ color: '#155215', width: 1.5, lineDash: [6, 3] }) }),
    partialHatch:  new Style({ fill: new Fill({ color: _hatchPartial }),  stroke: new Stroke({ color: '#92400e', width: 1.5, lineDash: [6, 3] }) }),
    missingHatch:  new Style({ fill: new Fill({ color: _hatchMissing }),  stroke: new Stroke({ color: '#991b1b', width: 1.5, lineDash: [6, 3] }) }),
};

function playgroundStyle(feature) {
    const props = feature.getProperties();
    const restricted = props.access === 'private' || props.access === 'customers';
    const c = playgroundCompleteness(props);
    if (restricted) {
        if (c === 'complete') return styles.completeHatch;
        if (c === 'partial')  return styles.partialHatch;
        return styles.missingHatch;
    }
    return styles[c] ?? styles.missing;
}

// ── Map ───────────────────────────────────────────────────────────────────────

const playgroundSource = new VectorSource();

const playgroundLayer = new VectorLayer({
    source: playgroundSource,
    style: playgroundStyle,
    zIndex: 10,
});

const scaleControl = new ScaleLine({ units: 'metric' });

export const map = new Map({
    target: 'map',
    layers: [basemap, playgroundLayer],
    controls: defaultControls().extend([scaleControl]),
    view: new View({
        center: fromLonLat(mapCenter),
        zoom: mapZoom,
        minZoom: mapMinZoom,
    }),
});

// Safari makes wheel events passive by default, preventing OL's MouseWheelZoom
// handler from calling preventDefault(). Registering any non-passive listener
// opts this element out of passive mode so OL's own handler can zoom normally.
map.getViewport().addEventListener('wheel', () => {}, { passive: false });

// ── Popup ─────────────────────────────────────────────────────────────────────

const popupEl = document.getElementById('popup');
const popup = new Overlay({
    element: popupEl,
    positioning: 'bottom-center',
    stopEvent: false,
});
map.addOverlay(popup);

function showPopup(coordinate, feature) {
    const props = feature.getProperties();
    const instanceUrl = props._instanceUrl;
    const osmId = props.osm_id;
    const c = playgroundCompleteness(props);
    const dot = c === 'complete' ? '<span class="dot-complete">●</span>'
              : c === 'partial'  ? '<span class="dot-partial">●</span>'
              :                    '<span class="dot-missing">●</span>';

    const lines = [];
    if (props.access) {
        const accessDict = { yes: 'öffentlich', private: 'privat', customers: 'nur für Gäste' };
        if (props.access in accessDict) lines.push(`Zugang: ${accessDict[props.access]}`);
    }
    if (props.area) lines.push(`Größe: ca. ${Math.round(props.area / 10) * 10} m²`);
    lines.push(`<small>${dot} ${c === 'complete' ? 'Vollständig' : c === 'partial' ? 'Teilweise erfasst' : 'Daten fehlen'}</small>`);
    if (instanceUrl && osmId) {
        lines.push(`<small class="text-muted">Klicken für Details</small>`);
    }

    const title = props.name || 'Spielplatz';
    const content = lines.join('<br>');

    popup.setPosition(coordinate);
    let popover = Popover.getInstance(popupEl);
    if (popover) popover.dispose();
    popover = new Popover(popupEl, {
        animation: false,
        container: popupEl,
        content,
        html: true,
        placement: 'top',
        title,
    });
    popover.show();
}

function hidePopup() {
    const popover = Popover.getInstance(popupEl);
    if (popover) popover.dispose();
    popup.setPosition(undefined);
}

// ── Interactions ──────────────────────────────────────────────────────────────

// Hover → popup
map.on('pointermove', function (e) {
    if (e.dragging) { hidePopup(); return; }
    const feature = map.forEachFeatureAtPixel(e.pixel, f => f, { layerFilter: l => l === playgroundLayer });
    if (feature) {
        map.getTargetElement().style.cursor = 'pointer';
        showPopup(e.coordinate, feature);
    } else {
        map.getTargetElement().style.cursor = '';
        hidePopup();
    }
});

// Click → open regional instance in detail panel
const detailBackdrop = document.getElementById('detail-backdrop');
const detailPanel = document.getElementById('detail-panel');
const detailIframe = document.getElementById('detail-iframe');
const detailTitle = document.getElementById('detail-panel-title');

function openDetailModal(url, title) {
    detailIframe.src = url;
    detailTitle.textContent = title;
    detailBackdrop.classList.add('open');
    detailPanel.classList.add('open');
}

function closeDetailModal() {
    detailBackdrop.classList.remove('open');
    detailPanel.classList.remove('open');
    detailIframe.src = '';
}

document.getElementById('detail-panel-close').addEventListener('click', closeDetailModal);
detailBackdrop.addEventListener('click', closeDetailModal);
// ESC forwarded from spielplatzkarte iframe (iframe captures keyboard focus after a click)
window.addEventListener('message', e => {
    if (e.data?.type === 'spielplatzkarte:escape') closeDetailModal();
});

let lastShift = 0;
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDetailModal(); return; }
    if (e.key !== 'Shift') { lastShift = 0; return; }
    const now = Date.now();
    if (now - lastShift < 500) {
        document.getElementById('topbar-search-input').select();
        lastShift = 0;
    } else {
        lastShift = now;
    }
});

map.on('singleclick', function (e) {
    const feature = map.forEachFeatureAtPixel(e.pixel, f => f, { layerFilter: l => l === playgroundLayer });
    if (!feature) return;
    const props = feature.getProperties();
    if (props._instanceUrl && props.osm_id) {
        const url = `${props._instanceUrl.replace(/\/$/, '')}/#W${props.osm_id}`;
        openDetailModal(url, props.name || props._instanceName || 'Spielplatz');
        hidePopup();
    }
});

// ── Search (Nominatim) ────────────────────────────────────────────────────────

async function searchLocation(query) {
    if (!query.trim()) return;
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url);
        const results = await res.json();
        if (results.length > 0) {
            const { lon, lat } = results[0];
            map.getView().animate({ center: fromLonLat([parseFloat(lon), parseFloat(lat)]), zoom: 13, duration: 600 });
        }
    } catch (e) {
        console.warn('[hub] search failed:', e);
    }
}

const searchInput = document.getElementById('topbar-search-input');
document.getElementById('topbar-search-icon').addEventListener('click', () => searchLocation(searchInput.value));
searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchLocation(searchInput.value);
});

// ── Locate me ─────────────────────────────────────────────────────────────────

document.getElementById('topbar-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        pos => {
            map.getView().animate({
                center: fromLonLat([pos.coords.longitude, pos.coords.latitude]),
                zoom: 13,
                duration: 600,
            });
        },
        err => console.warn('[hub] geolocation error:', err),
    );
});

// ── Load data ─────────────────────────────────────────────────────────────────

const format = new GeoJSON({ featureProjection: 'EPSG:3857' });

export async function loadAllInstances() {
    const listEl = document.getElementById('instance-list');
    const countEl = document.getElementById('instance-count');

    let registry;
    try {
        registry = await loadRegistry();
    } catch (e) {
        listEl.innerHTML = `<small class="text-danger">Registry konnte nicht geladen werden.</small>`;
        console.error(e);
        return;
    }

    // Render skeleton instance list immediately
    listEl.innerHTML = registry.map(inst => `
        <div class="instance-item" id="inst-${slugify(inst.name)}">
            <span class="instance-name">${inst.name}</span>
            <span class="instance-status loading">
                <span class="bi bi-arrow-repeat spin"></span>
            </span>
        </div>
    `).join('');

    let totalCount = 0;

    // Fetch all instances in parallel, update UI as each resolves
    await Promise.all(registry.map(async inst => {
        const itemEl = document.getElementById(`inst-${slugify(inst.name)}`);
        const statusEl = itemEl?.querySelector('.instance-status');

        try {
            // Fetch meta, version and playgrounds in parallel
            const [meta, version, result] = await Promise.all([
                fetchInstanceMeta(inst),
                fetchInstanceVersion(inst),
                fetchInstancePlaygrounds(inst),
            ]);
            if (!result) throw new Error('no data');

            // Use the OSM relation name if available, fall back to registry name
            if (meta?.name) {
                inst = { ...inst, name: meta.name };
                if (itemEl) itemEl.querySelector('.instance-name').textContent = meta.name;
            }

            const features = format.readFeatures(result.geojson);

            // Tag each feature with its source instance URL for click navigation
            features.forEach(f => {
                f.set('_instanceUrl', inst.url);
                f.set('_instanceName', inst.name);
            });

            playgroundSource.addFeatures(features);
            totalCount += features.length;

            if (statusEl) {
                statusEl.className = 'instance-status ok';
                const versionTag = version ? ` <span class="instance-version">v${version}</span>` : '';
                statusEl.innerHTML = `<span class="bi bi-check-circle-fill"></span> ${features.length}${versionTag}`;
            }
            countEl.textContent = `${totalCount} Spielplätze`;
        } catch {
            if (statusEl) {
                statusEl.className = 'instance-status error';
                statusEl.innerHTML = `<span class="bi bi-x-circle-fill"></span> Fehler`;
            }
        }
    }));

    countEl.textContent = `${totalCount} Spielplätze in ${registry.length} Regionen`;
}

function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
}
