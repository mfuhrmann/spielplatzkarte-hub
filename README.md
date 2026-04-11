# Spielplatzkarte Hub

A federation map that aggregates playgrounds from multiple regional [Spielplatzkarte](https://github.com/mfuhrmann/spielplatzkarte) instances onto a single global map.

> Each regional instance covers one city, district, or Bundesland. The Hub pulls data from all registered instances and shows them together — no central database required.

---

## How it works

```
browser → Hub (nginx) → loads registry.json
                      → fetches /api/rpc/get_playgrounds from each instance (CORS)
                      → fetches /api/rpc/get_meta       from each instance (CORS)
```

The Hub is a thin static frontend. It has no database of its own — all playground data lives in the regional instances. On load it:

1. Reads `registry.json` — the list of registered instances
2. Fetches metadata (`get_meta`) and playgrounds (`get_playgrounds`) from each instance in parallel
3. Renders all playgrounds on one map with the same completeness colouring as the regional apps
4. On click, opens the playground in its regional instance

---

## Features

- All playgrounds from all registered instances on one map
- Same completeness colouring as regional instances (🟢 vollständig / 🟡 teilweise / 🔴 fehlen)
- Instance name resolved from the OSM relation name (`get_meta`) — no manual naming needed
- Instance panel with live load status and app version per region (✓ count v0.x.x / error)
- Hover popup: name, access, size, completeness
- Click: opens playground in a full-screen modal overlay (iframe of the regional instance)
- **ESC** or backdrop click closes the modal
- Location search via [Nominatim](https://nominatim.openstreetmap.org) in the top bar — focus with **Double-Shift**
- Locate me button: centres the map on the user's current GPS position
- Single Docker container — no database, no PostgREST

---

## Registering an instance

Edit `public/registry.json` and add an entry:

```json
[
  {
    "name": "Fallback name",
    "url": "https://your-instance.example.de",
    "bbox": [8.1, 49.8, 9.0, 50.3]
  }
]
```

- `name` — displayed as fallback if `get_meta` is unavailable
- `url` — base URL of the regional Spielplatzkarte instance (no trailing slash)
- `bbox` — `[minLon, minLat, maxLon, maxLat]` in WGS84, optional

The instance name is automatically resolved from the OSM relation name via `get_meta` at runtime. The registry `name` is only used as a fallback.

> **Note:** The regional instance must have CORS enabled on its `/api/` endpoint. See [Requirements for regional instances](#requirements-for-regional-instances).

---

## Requirements for regional instances

Each registered Spielplatzkarte instance must:

1. **Enable CORS** on `/api/` — add `add_header Access-Control-Allow-Origin "*" always;` to the `location /api/` block in `nginx.conf` (included since spielplatzkarte v0.2.1)
2. **Expose `get_meta`** — the `api.sql` function added in spielplatzkarte v0.2.1 returns the region name, playground count, and bounding box

Both are included in spielplatzkarte v0.2.1 and later.

---

## Deploy

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env` if needed (defaults work for a local setup):

```env
MAP_CENTER=10.5,51.2   # lon,lat — centre of Germany
MAP_ZOOM=5
APP_PORT=8090
```

### 2. Register instances

Edit `public/registry.json` and add your regional instances.

### 3. Start

```bash
docker compose up -d --build
```

The Hub will be available at `http://localhost:8090` (or the port set in `APP_PORT`).

---

## Configuration reference

| Variable | Default | Description |
|---|---|---|
| `REGISTRY_URL` | `./registry.json` | URL of the instance registry — can be a remote URL |
| `MAP_CENTER` | `10.5,51.2` | Initial map centre as `lon,lat` |
| `MAP_ZOOM` | `5` | Initial zoom level |
| `MAP_MIN_ZOOM` | `4` | Minimum zoom level |
| `APP_PORT` | `8090` | Host port the Hub is exposed on |

---

## Tech Stack

| Component | Technology |
|---|---|
| Map | [OpenLayers](https://openlayers.org/) |
| UI framework | [Bootstrap 5](https://getbootstrap.com/) + [Bootstrap Icons](https://icons.getbootstrap.com/) |
| Build tool | [Vite 6](https://vitejs.dev/) |
| Language | JavaScript (ES Modules) |
| Web server | [nginx](https://nginx.org/) |
| Container runtime | [Docker](https://www.docker.com/) / Docker Compose |

---

## Local development

```bash
npm install
npm start    # dev server at http://localhost:5173
```

A running regional instance is needed to load playground data. Point `public/registry.json` at it.

---

## Relation to Spielplatzkarte

| | Spielplatzkarte | Spielplatzkarte Hub |
|---|---|---|
| Scope | One region (city / Kreis / Bundesland) | All registered regions |
| Data | Local PostGIS database | Fetched live from regional instances |
| Detail panel | Full (equipment, photos, POIs, reviews) | Regional instance in modal overlay |
| Infrastructure | PostgreSQL + PostgREST + nginx | nginx only |

---

## License

[GNU General Public License v3.0](LICENSE)

Map data © [OpenStreetMap](https://openstreetmap.org) contributors, available under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright).
