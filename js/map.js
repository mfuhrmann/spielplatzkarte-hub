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
import { loadRegistry, fetchInstancePlaygrounds } from './registry.js';
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

const styles = {
    complete: new Style({ fill: new Fill({ color: 'rgba(34,139,34,0.22)' }),  stroke: new Stroke({ color: '#155215', width: 1.5 }) }),
    partial:  new Style({ fill: new Fill({ color: 'rgba(234,179,8,0.22)' }), stroke: new Stroke({ color: '#92400e', width: 1.5 }) }),
    missing:  new Style({ fill: new Fill({ color: 'rgba(239,68,68,0.18)' }), stroke: new Stroke({ color: '#991b1b', width: 1.5 }) }),
};

function playgroundStyle(feature) {
    return styles[playgroundCompleteness(feature.getProperties())] ?? styles.missing;
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

// Click → open regional instance
map.on('singleclick', function (e) {
    const feature = map.forEachFeatureAtPixel(e.pixel, f => f, { layerFilter: l => l === playgroundLayer });
    if (!feature) return;
    const props = feature.getProperties();
    if (props._instanceUrl && props.osm_id) {
        const url = `${props._instanceUrl.replace(/\/$/, '')}/#W${props.osm_id}`;
        window.open(url, '_blank', 'noopener');
    }
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
            const result = await fetchInstancePlaygrounds(inst);
            if (!result) throw new Error('no data');

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
                statusEl.innerHTML = `<span class="bi bi-check-circle-fill"></span> ${features.length}`;
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
