# Design Document: Smart Market Pickup Search

## Overview

This design reworks the existing Cambodia Branch & Route Search application to add a smart search workflow. A delivery coordinator searches for a **market name**; the system resolves that market's geographic coordinates from `routes.json` (the market location database), then calculates and displays the **nearest pickup branch** from the authoritative PickupBranches dataset — showing the market name, the correct pickup branch ID, and the distance in kilometers.

### Critical Data Source Rule

Two datasets are involved, and they serve strictly different purposes:

- **PickupBranches.xlsx — AUTHORITATIVE branch registry.** ~597 records, each with a Delivery Store code in the format `"BANA001 - Chamnaom"`, plus province (KH), district (EN + KH), latitude, and longitude. **This is the ONLY valid source of branch identifiers shown to users.** It is converted once to `data/pickup_branches.json` and loaded at startup.
- **routes.json — market location database ONLY.** ~600 market entries used *exclusively* to resolve a market name to coordinates. Its `branch_id` field (e.g., `MON02`, `SIE01`, `KAN`, `PNP05`) is **legacy/incorrect data and MUST NEVER be displayed or returned as a branch assignment.**

Every search result displays three things: **market name + correct pickup branch ID (`"BANA001 - Chamnaom"`) + distance in km**. The legacy `branch_id` from `routes.json` never appears in the API response or the UI.

### Scope of Rework

The existing `/api/smart-find` endpoint is a placeholder that (incorrectly) returns the nearest *route* from `routes.json` as `nearest_post_office`. It must be reworked to:
1. Resolve the market from `routes.json` (fuzzy + Khmer normalization) or external geocoding with caching.
2. Find the nearest pickup branch from the authoritative PickupBranches dataset.
3. Return a response whose branch identifier comes solely from PickupBranches.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (public/)                         │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │ Smart Find   │  │  Map: blue pin + │  │  Detail Card     │    │
│  │ Button/Form  │──│  red pin +       │  │  (market + branch│    │
│  │              │  │  dashed line     │  │   ID + distance) │    │
│  └──────┬───────┘  └────────▲─────────┘  └────────▲─────────┘    │
│         │ GET /api/smart-find │ JSON response       │             │
└─────────┼────────────────────┼─────────────────────┼─────────────┘
          ▼                    │                     │
┌─────────────────────────────────────────────────────────────────┐
│                     Server (server.js)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              GET /api/smart-find (reworked)                │   │
│  └──────┬───────────────────────────────────────────────────┘   │
│         │                                                         │
│  ┌──────▼────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Search_Engine │  │ Geocoding_   │  │ Pickup_Branch_Finder │   │
│  │ market resolve│──│ Service +    │──│ (Haversine nearest,  │   │
│  │ (Fuse.js +    │  │ cache +      │  │  authoritative data) │   │
│  │  Khmer norm)  │  │ rate limit   │  │                      │   │
│  └──────┬────────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                  │                     │               │
│  ┌──────▼──────┐  ┌────────▼────────┐  ┌─────────▼────────────┐  │
│  │ routes.json │  │ geocoding_      │  │ pickup_branches.json │  │
│  │ (markets →  │  │ cache.json      │  │ (AUTHORITATIVE,      │  │
│  │  coords)    │  │                 │  │  ~597 branches)      │  │
│  └─────────────┘  └────────▲────────┘  └──────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────┘
                           │ (cache miss → fallback, rate-limited)
                           ▼
                  ┌──────────────────────┐
                  │  Nominatim/OSM API   │
                  │  (External Geocoding)│
                  └──────────────────────┘
```

### Data Flow for Smart Find

1. User enters a market name → clicks "Smart Find".
2. Frontend sends `GET /api/smart-find?q=<query>&max_dist=<km>`.
3. Server validates `q` (reject empty/whitespace-only/missing with 400).
4. **Market resolution (Search_Engine)** — ordered stages, first hit wins:
   - **Stage A — local_db**: Normalize (Khmer NFC + decomposed vowel correction), exact/substring then fuzzy match (Fuse.js) against `routes.json`. On match, extract market name + lat + lng. If any of those required fields is missing on the matched record, **fail the request** with an incomplete-data error (do not silently fall through).
   - **Stage B — cache**: If no local match, check the geocoding cache by normalized query.
   - **Stage C — geocoding**: On cache miss, call Nominatim (Cambodia-biased, rate-limited). On success, cache the result (including partial coordinates) and use it.
5. **Nearest branch (Pickup_Branch_Finder)**: Compute Haversine distance from resolved coordinates to every pickup branch in `pickup_branches.json`, apply `max_dist` filter during the scan, return the single nearest branch.
6. **Response**: `{ query, resolved_market, coords, coords_source, pickup_branch: { branch_id, ... }, distance_km }` — `coords_source` accurately reflects the stage that produced the coordinates (`local_db` | `cache` | `geocoding`).
7. Frontend renders a blue market pin, a red pickup-branch pin, a dashed connecting line, and a detail card.

### Coordinate Source Accuracy

`coords_source` is set at the exact point coordinates are obtained and never overwritten downstream:
- `local_db` — resolved from `routes.json`.
- `cache` — retrieved from `geocoding_cache.json`.
- `geocoding` — resolved via a live Nominatim call.

## Components and Interfaces

### 1. Pickup Branch Loader (authoritative registry)

**Purpose**: Load `data/pickup_branches.json` (pre-converted from `PickupBranches.xlsx`) at startup as the sole source of branch identifiers.

**Conversion** (`scripts/convert-pickup-branches.js`, already present): parses the `Delivery Store` cell `"BANA001 - Chamnaom"` into `store_code` (`BANA001`) and `store_name` (`Chamnaom`), preserving the full original string. Records with non-numeric latitude/longitude are dropped during conversion.

**Runtime interface**:
```javascript
function loadPickupBranches(filePath) -> PickupBranch[]
```

Loading rules (Req 1.3, 1.5):
- File **missing or malformed** → log an error and continue with an **empty** branch list. Only if the error-logging or empty-list initialization itself throws does the system fail completely.
- File **valid but zero records** → continue **normally, no error logged**; zero branches is valid data.

**Branch ID for display** — the `Correct_Branch_ID` returned to clients is the full `"BANA001 - Chamnaom"` string, reconstructed as `` `${store_code} - ${store_name}` `` (or the preserved raw value). The legacy `routes.json` `branch_id` is never involved.

### 2. Market Resolver (Search_Engine)

**Purpose**: Resolve a query string to `{ marketName, lat, lng, source }`.

**Interface**:
```javascript
async function resolveMarket(query) -> {
  marketName: string,
  lat: number,
  lng: number,
  source: 'local_db' | 'cache' | 'geocoding'
} | { error: string, code: number }
```

Behavior:
- Normalizes the query with `normalizeKhmer` (NFC + decomposed vowel correction + zero-width-space removal).
- Searches `routes.json` across `market`, `market_kh`, `village`, `village_kh`, `commune`, `commune_kh`, `district`, `district_kh`, `province`, `province_kh`. **The `branch_id` field is excluded from search and from output.**
- On a matched record, if `market`/`latitude`/`longitude` is missing, returns an incomplete-data error (Req 2.2).
- Falls through local → cache → geocoding as described above.

### 3. Fuzzy Search Module (Fuse.js)

**Purpose**: Approximate matching when exact/substring matching fails.

**Library**: `fuse.js` (^7.0.0) — weighted multi-field search, no native dependencies.

**Configuration**:
```javascript
new Fuse(routes, {
  keys: ['market', 'market_kh', 'village', 'village_kh',
         'commune', 'commune_kh', 'district', 'district_kh',
         'province', 'province_kh'],
  threshold: 0.4,          // Fuse score 0 = perfect; ~0.4 ≈ 0.6 similarity
  includeScore: true,
  ignoreLocation: true
});
```

Rules:
- Results ranked by similarity (ascending Fuse score = descending similarity), best match chosen (Req 5.3, 5.4).
- If **no** candidate meets the threshold, return **no result** and do **NOT** fall back to a below-threshold match (Req 5.6). Resolution then proceeds to cache/geocoding.

### 4. Geocoding Service (Nominatim) + Rate Limiting

**Service**: Nominatim (OpenStreetMap) — free, no key, supports Khmer.

**Request**:
```
GET https://nominatim.openstreetmap.org/search
  ?q=<query>&format=json&countrycodes=kh
  &viewbox=102.3,10.4,107.6,14.7&bounded=1&limit=1
```

**Rate limiting**: serialized queue enforcing ≥1 s between outbound requests (Nominatim policy). A required `User-Agent` header is sent.

**Timeout**: 8 s per request. Unreachable / timeout / HTTP 429 → error response suggesting retry later (Req 2.7).

**Partial extraction**: If only latitude or only longitude can be extracted, the partial result is still cached (Req 6.1).

### 5. Geocoding Cache

**Purpose**: Avoid redundant external calls; persist across restarts.

**Interface**:
```javascript
loadCache(path) -> Map            // corrupted/missing → new empty cache (Req 6.4)
cacheGet(normalizedQuery) -> entry | undefined
cachePut(normalizedQuery, entry)  // write-through to disk after each success (Req 6.3)
```

- Keyed by **normalized query text**.
- Stores resolved coordinates (possibly partial), display name.
- Loaded at startup; each successful geocode persisted immediately.

### 6. Nearest Pickup Branch Calculator (Pickup_Branch_Finder)

**Purpose**: Find the closest authoritative pickup branch to given coordinates.

**Interface**:
```javascript
function findNearestPickupBranch(lat, lng, branches, maxDist = Infinity)
  -> { ...branch, distance_km } | null
```

**Algorithm**: brute-force Haversine over all branches (~597; sub-millisecond). The `maxDist` filter is applied **during** the scan so out-of-range branches cannot be selected (Req 3.5). Returns `null` when no branch is within range (caller returns an error — Req 3.6).

### 7. Reworked `GET /api/smart-find`

**Request**: `q` (required, non-blank), `max_dist` (optional, km).

**Success response** (see Data Models). **Error responses**: `400` for blank/missing `q`; `404` for unresolved market or no branch in range; `422` for incomplete matched market record; `503` for geocoding unreachable/rate-limited.

### 8. Frontend Visualization (Map_UI)

- **Blue pin** at the resolved market location; popup shows market name (Req 7.1).
- **Red pin** at the nearest pickup branch; popup shows `Correct_Branch_ID` (Req 7.2, 7.5).
- **Dashed polyline** connecting the two markers (Req 7.3).
- **Viewport** fits both markers with padding (Req 7.4).
- **Detail card** in the sidebar: market name (title), `Correct_Branch_ID` prominently, province, district (EN + KH), coordinates, distance labeled `Distance: 12.34 km`, an "Open in Google Maps" link (new tab), and "Back to list" (Req 4.*, 9.*).
- Distance is formatted to **two decimals + " km"** (Req 4.3). The legacy `routes.json` `branch_id` is never rendered (Req 4.2).

## Data Models

### PickupBranch (authoritative — `data/pickup_branches.json`)

```json
{
  "store_code": "BANA001",
  "store_name": "Chamnaom",
  "branch_id": "BANA001 - Chamnaom",
  "province_kh": "បាត់ដំបង",
  "district_en": "Banan",
  "district_kh": "បាណន់",
  "latitude": 13.0254,
  "longitude": 103.1234
}
```

`branch_id` here is the **Correct_Branch_ID** — the only identifier shown to users. (`store_code`/`store_name` are retained for reference and can reconstruct it.)

### Market_Location (read-only source — `routes.json`)

Used only for coordinate resolution. `branch_id` present in this file is **legacy and ignored**:
```json
{
  "id": 1,
  "branch_id": "MON02",          // LEGACY — never displayed/returned
  "latitude": 12.112367,
  "longitude": 106.886155,
  "province": "Mondul Kiri", "province_kh": "មណ្ឌលគិរី",
  "district": "Kaev Seima", "district_kh": "កែវសីមា",
  "commune": "", "commune_kh": "",
  "village": "", "village_kh": "",
  "market": "Kaev Seima Market", "market_kh": "ផ្សារកែវសីមា",
  "google_maps_url": "https://www.google.com/maps?q=12.112367,106.886155"
}
```

### Geocoding cache entry (`geocoding_cache.json`)

```json
{
  "<normalized_query>": {
    "lat": 11.5564,           // may be null if only lng extracted (partial)
    "lng": 104.9282,          // may be null if only lat extracted (partial)
    "display_name": "Phsar Thmei, Phnom Penh",
    "cached_at": "2024-01-15T10:30:00Z"
  }
}
```

### Smart-Find success response

```json
{
  "query": "Phsar Thmei",
  "resolved_market": "Phsar Thmei Market",
  "coords": { "lat": 11.5564, "lng": 104.9282 },
  "coords_source": "local_db",
  "pickup_branch": {
    "branch_id": "PNP001 - Phsar Thmei Store",
    "store_code": "PNP001",
    "store_name": "Phsar Thmei Store",
    "province_kh": "រាជធានីភ្នំពេញ",
    "district_en": "Daun Penh",
    "district_kh": "ដូនពេញ",
    "latitude": 11.5600,
    "longitude": 104.9200
  },
  "distance_km": 0.95
}
```

No legacy `routes.json` `branch_id` appears anywhere in the response (Req 8.4).

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `data/pickup_branches.json` | Create | Authoritative branches converted from `PickupBranches.xlsx` |
| `scripts/convert-pickup-branches.js` | Present | Excel→JSON conversion (parses `"CODE - Name"`) |
| `server.js` | Modify | Load pickup branches; add resolver, fuzzy, geocoding+cache, nearest-branch; rework `/api/smart-find` |
| `data/geocoding_cache.json` | Create | Empty cache `{}` |
| `public/app.js` | Modify | Rework Smart Find handler; blue+red markers, dashed line, detail card with correct branch ID + distance |
| `public/index.html` | Modify | Detail card fields for branch ID / distance |
| `public/style.css` | Modify | Blue market pin + dashed line styles |
| `package.json` | Modify | Add `fuse.js`, `node-fetch`; keep `xlsx` (dev) |

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `fuse.js` | ^7.0.0 | Fuzzy multi-field market search |
| `node-fetch` | ^2.7.0 | HTTP client for Nominatim (CommonJS-compatible) |
| `xlsx` | ^0.18.5 | (dev) one-time Excel→JSON conversion |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Each property below is universally quantified and intended for property-based testing (minimum 100 iterations per property).

### Property 1: Haversine is non-negative, symmetric, and zero on identity

*For any* two coordinate pairs `(lat1, lng1)` and `(lat2, lng2)`, `haversine` returns a value `>= 0`, is symmetric (`haversine(a,b) == haversine(b,a)`), and returns `0` (within floating-point tolerance) when both points are identical.

**Validates: Requirements 3.1**

### Property 2: Nearest pickup branch is truly nearest

*For any* resolved coordinates and any non-empty set of pickup branches, the branch returned by `findNearestPickupBranch` has a distance less than or equal to the distance of every branch in the set to those coordinates.

**Validates: Requirements 3.1, 3.2**

### Property 3: Max-distance filter correctness

*For any* `max_dist > 0` and any resolved coordinates, if `findNearestPickupBranch` returns a branch, that branch's `distance_km` is `<= max_dist`; and if every branch exceeds `max_dist`, the function returns `null` (leading to an error response).

**Validates: Requirements 3.5, 3.6**

### Property 4: Khmer normalization idempotence

*For any* input string `s`, normalizing twice equals normalizing once: `normalizeKhmer(normalizeKhmer(s)) == normalizeKhmer(s)`, and known decomposed vowel sequences map to their composed forms.

**Validates: Requirements 5.1**

### Property 5: Fuzzy match ordering with highest score first

*For any* query, the fuzzy search results are ordered by similarity in non-increasing order, so the first result is the highest-scoring match returned as the resolved market.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 6: No below-threshold fuzzy fallback

*For any* query for which no candidate meets the similarity threshold, the fuzzy resolver returns no result and never returns a below-threshold record as a match.

**Validates: Requirements 5.6**

### Property 7: Response schema completeness with accurate coordinate source

*For any* successful smart-find response, the response contains `query`, `resolved_market`, `coords.lat`, `coords.lng`, `pickup_branch.branch_id`, and a numeric `distance_km >= 0`; and `coords_source` is exactly one of `local_db`, `cache`, or `geocoding`, matching the stage that actually produced the coordinates.

**Validates: Requirements 8.2, 8.3, 3.3**

### Property 8: Authoritative branch identifier invariant

*For any* smart-find result, the returned `pickup_branch.branch_id` equals a Delivery Store code from the PickupBranches dataset (format `"CODE - Name"`) and is never the legacy `branch_id` of the matched `routes.json` record.

**Validates: Requirements 1.4, 3.4, 4.2, 8.4**

### Property 9: Geocoding cache round-trip preserves coordinates (including partial)

*For any* geocoding result (including partial results where only latitude or only longitude was extracted), after caching under the normalized query, a subsequent lookup for that normalized query returns the same stored coordinates without invoking the Geocoding_Service.

**Validates: Requirements 2.5, 6.1, 6.2**

### Property 10: Distance formatting

*For any* non-negative distance value, the display formatter produces a string matching `^\d+\.\d{2} km$` (two decimal places followed by " km").

**Validates: Requirements 4.3**

### Property 11: Field-coverage matching across English and Khmer fields

*For any* `routes.json` record and any of its non-empty searchable field values (`market`, `village`, `commune`, `district`, `province` and their `_kh` variants) used as the query, market resolution locates that record.

**Validates: Requirements 2.3, 5.5**

### Property 12: Delivery-store parse round-trip

*For any* delivery-store string of the form `"CODE - Name"`, parsing into `store_code`/`store_name` and reconstructing yields the original combined `branch_id`, with `store_code` and `store_name` correctly split.

**Validates: Requirements 1.2**

### Property 13: Incomplete matched record fails the request

*For any* matched `routes.json` record missing any required field (`market`, `latitude`, or `longitude`), the resolver returns an incomplete-data error rather than a partial or fallback result.

**Validates: Requirements 2.2**

### Property 14: Blank query rejection

*For any* query string that is empty or consists solely of whitespace (and for a missing `q`), the `/api/smart-find` endpoint returns HTTP 400.

**Validates: Requirements 8.5**

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `pickup_branches.json` missing or malformed | Log error; continue with empty branch list (Req 1.3). Only if logging/empty-init itself fails does the system fail completely. |
| `pickup_branches.json` valid but zero records | Continue normally, **no error logged** — zero branches is valid (Req 1.5). |
| Matched market record missing name/lat/lng | Return `422` incomplete-data error; do not fall through (Req 2.2). |
| No local match and geocoding returns empty | Return `404` "market could not be found" (Req 2.6). |
| Geocoding timeout (>8s) / unreachable / HTTP 429 | Return `503` with retry-later message (Req 2.7). |
| No pickup branch within `max_dist` | Return `404` "no pickup branch within range" (Req 3.6). |
| Cache file missing or corrupted | Create new empty cache, continue (Req 6.4). |
| Invalid coordinates in branch data | Skip record during conversion/loading, log warning. |
| `q` empty, whitespace-only, or missing | Return `400` validation error (Req 8.5). |
| Fuzzy match below threshold only | Return no fuzzy result; proceed to cache/geocoding; never use below-threshold match (Req 5.6). |

## Testing Strategy

### Dual approach

- **Unit / example tests** — loading behavior, error paths, UI rendering, endpoint contract, and Leaflet visualization (blue pin, red pin, dashed line, detail card).
- **Property-based tests** — the 14 correctness properties above, covering Haversine math, nearest-branch selection, filtering, Khmer normalization, fuzzy ordering/threshold, response schema + source accuracy, the authoritative-id invariant, cache round-trip, distance formatting, field coverage, parse round-trip, incomplete-record failure, and blank-query rejection.

### Property-based testing configuration

- **Library**: `fast-check` (JavaScript/Node) — no from-scratch PBT implementation.
- **Iterations**: minimum **100** per property.
- **Generators**: random coordinate pairs (Cambodia-biased and global), random branch sets, random `max_dist` values, random Khmer/English strings including decomposed vowel sequences and zero-width spaces, `"CODE - Name"` delivery-store strings, whitespace-only strings, and synthetic geocoding results including partial coordinates.
- **Tagging**: each property test is tagged `Feature: smart-market-pickup-search, Property {number}: {property_text}`.
- **Mapping**: each of the 14 properties is implemented by a single property-based test.

### Integration / smoke tests (not PBT)

- **INTEGRATION** — Nominatim call uses Cambodia bias on local miss (Req 2.4); timeout/429 yields retry-later (Req 2.7). Verified with a stubbed HTTP client, 1–3 examples.
- **SMOKE** — request completes within 5s (local) / 10s (geocoding) (Req 8.6); startup loads both datasets.

### UI tests

- Example/DOM-based tests for Requirements 4.1, 4.2, 4.4, 7.1–7.5, 9.1–9.4: assert blue market pin, red pickup-branch pin, dashed connecting line, viewport fit, popup contents, detail-card fields (market name, correct branch id, province, district EN+KH, coordinates, labeled distance), Google Maps link (new tab), and "Back to list" behavior. These confirm the legacy `routes.json` `branch_id` is never rendered.
