# Implementation Plan: Smart Market Pickup Search

## Overview

This plan reworks the existing `/api/smart-find` endpoint (and its frontend) so that a market name search resolves coordinates from `routes.json` (fuzzy + Khmer-aware, with geocoding fallback and caching), then finds the nearest **authoritative** pickup branch from `pickup_branches.json` via Haversine distance. The legacy `routes.json` `branch_id` is never surfaced. Implementation proceeds bottom-up: data conversion → pickup branch loading → market resolver (normalization → exact/substring → fuzzy) → geocoding + rate limiting → geocoding cache (with partial-coordinate support) → nearest-branch calculator → reworked endpoint with full error-code coverage → frontend visualization (blue/red pins, dashed line, detail card). Property-based tests (`fast-check`, minimum 100 iterations each) for the 14 correctness properties in `design.md` are added as sub-tasks next to the implementation they validate.

## Tasks

- [ ] 1. Convert PickupBranches Excel to JSON with authoritative branch_id
  - [ ] 1.1 Install `fast-check` as a dev dependency for property-based testing

  - [ ] 1.2 Update `scripts/convert-pickup-branches.js` to parse the "Delivery Store" cell (e.g., "BANA001 - Chamnaom") into `store_code` and `store_name`, and reconstruct/preserve the full `branch_id` string on each output record
    - _Requirements: 1.2_

  - [ ] 1.3 Re-run the conversion script to regenerate `data/pickup_branches.json` so every valid record includes `store_code`, `store_name`, `branch_id`, `province_kh`, `district_en`, `district_kh`, `latitude`, `longitude`
    - _Requirements: 1.2_

  - [ ]* 1.4 Write property test for delivery-store parse round-trip
    - **Property 12: Delivery-store parse round-trip**
    - **Validates: Requirements 1.2**

- [ ] 2. Load pickup branch data at server startup
  - [ ] 2.1 Implement `loadPickupBranches(filePath)`: missing or malformed file logs an error and continues with an empty branch list; a valid file with zero records continues normally with no error logged
    - _Requirements: 1.3, 1.5_

  - [ ] 2.2 Wire `loadPickupBranches` into `server.js` startup, replacing the ad-hoc loading logic, and ensure `routes.json`'s `branch_id` field is never read as a source of branch identifiers
    - _Requirements: 1.1, 1.4_

  - [ ]* 2.3 Write unit tests for the loader: missing file, malformed JSON, a valid file with zero records (no error logged), and a well-formed file with records
    - _Requirements: 1.3, 1.5_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement market resolver core: Khmer normalization and local exact/substring match
  - [ ] 4.1 Implement `normalizeKhmer(str)` (NFC normalization, decomposed vowel correction, zero-width-space removal) in `server.js`, exported for testing
    - _Requirements: 5.1_

  - [ ]* 4.2 Write property test for Khmer normalization idempotence
    - **Property 4: Khmer normalization idempotence**
    - **Validates: Requirements 5.1**

  - [ ] 4.3 Implement `resolveMarket` Stage A: exact/substring match against `market`, `market_kh`, `village`, `village_kh`, `commune`, `commune_kh`, `district`, `district_kh`, `province`, `province_kh` (excluding `branch_id`); on a match, validate `market`/`latitude`/`longitude` are present and return an incomplete-data error if any are missing
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.4 Write property test for incomplete matched record failing the request
    - **Property 13: Incomplete matched record fails the request**
    - **Validates: Requirements 2.2**

  - [ ]* 4.5 Write property test for field-coverage matching across English and Khmer fields
    - **Property 11: Field-coverage matching across English and Khmer fields**
    - **Validates: Requirements 2.3, 5.5**

- [ ] 5. Implement fuzzy search module (Fuse.js)
  - [ ] 5.1 Install `fuse.js` and initialize a weighted Fuse index over `routes.json` fields at startup (market, market_kh, village, village_kh, commune, commune_kh, district, district_kh, province, province_kh), threshold ~0.4, excluding `branch_id`
    - _Requirements: 5.2, 5.5_

  - [ ] 5.2 Implement `fuzzySearchRoutes(query, threshold)` returning matches sorted by similarity descending, returning no result when nothing exceeds the threshold
    - _Requirements: 5.2, 5.3, 5.4, 5.6_

  - [ ] 5.3 Integrate fuzzy search as the fallback stage in `resolveMarket` (after Stage A fails), applying `normalizeKhmer` to the query first
    - _Requirements: 2.1, 5.1_

  - [ ]* 5.4 Write property test for fuzzy match ordering with highest score first
    - **Property 5: Fuzzy match ordering with highest score first**
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [ ]* 5.5 Write property test for no below-threshold fuzzy fallback
    - **Property 6: No below-threshold fuzzy fallback**
    - **Validates: Requirements 5.6**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement geocoding integration with Nominatim and rate limiting
  - [ ] 7.1 Implement `geocodeLocation(query)` calling the Nominatim search API with Cambodia bias (`countrycodes=kh`, `viewbox=102.3,10.4,107.6,14.7`, `bounded=1`, `limit=1`) via `node-fetch`
    - _Requirements: 2.4_

  - [ ] 7.2 Add the required `User-Agent` header and 8-second timeout handling (reject with a timeout error past 8s) to `geocodeLocation`
    - _Requirements: 2.7_

  - [ ] 7.3 Add rate-limit protection ensuring at least 1 second between consecutive Nominatim calls
    - _Requirements: 2.7_

  - [ ]* 7.4 Write integration test (stubbed HTTP client) verifying the Cambodia-biased request parameters, and that a timeout or HTTP 429 produces a retry-later error
    - _Requirements: 2.4, 2.7_

- [ ] 8. Implement geocoding cache with partial-coordinate support
  - [ ] 8.1 Implement cache `load`/`get`/`put` supporting partial coordinates (lat-only or lng-only) and resetting to an empty cache when the file is missing or corrupted
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ] 8.2 Integrate cache lookup (Stage B) before geocoding (Stage C) into `resolveMarket`: check the cache by normalized query, fall back to `geocodeLocation` on a miss, and write-through successful geocoding results (including partial coordinates) to the cache
    - _Requirements: 2.5, 2.6, 6.1, 6.2, 6.3_

  - [ ]* 8.3 Write property test for geocoding cache round-trip preserving coordinates including partial results
    - **Property 9: Geocoding cache round-trip preserves coordinates (including partial)**
    - **Validates: Requirements 2.5, 6.1, 6.2**

  - [ ]* 8.4 Write unit test for a missing/corrupted cache file resetting to an empty cache and continuing
    - _Requirements: 6.4_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement nearest pickup branch calculator (Haversine)
  - [ ] 10.1 Implement `haversine(lat1, lng1, lat2, lng2)` in `server.js`, exported for testing
    - _Requirements: 3.1_

  - [ ]* 10.2 Write property test for Haversine non-negativity, symmetry, and zero-on-identity
    - **Property 1: Haversine is non-negative, symmetric, and zero on identity**
    - **Validates: Requirements 3.1**

  - [ ] 10.3 Implement `findNearestPickupBranch(lat, lng, branches, maxDist)` applying the `max_dist` filter during the scan and returning `null` when no branch is in range
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 10.4 Write property test that the returned branch is truly the nearest
    - **Property 2: Nearest pickup branch is truly nearest**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 10.5 Write property test for max-distance filter correctness
    - **Property 3: Max-distance filter correctness**
    - **Validates: Requirements 3.5, 3.6**

- [ ] 11. Rework the `/api/smart-find` endpoint with full error-code coverage
  - [ ] 11.1 Add request validation to `/api/smart-find` rejecting blank, whitespace-only, or missing `q` with a 400 response
    - _Requirements: 8.5_

  - [ ]* 11.2 Write property test for blank query rejection
    - **Property 14: Blank query rejection**
    - **Validates: Requirements 8.5**

  - [ ] 11.3 Wire `resolveMarket` and `findNearestPickupBranch` into the `/api/smart-find` handler in resolution order (local_db → cache → geocoding → nearest branch)
    - _Requirements: 8.1, 8.2_

  - [ ] 11.4 Build the success response schema `{ query, resolved_market, coords: { lat, lng }, coords_source, pickup_branch: { branch_id, store_code, store_name, province_kh, district_en, district_kh, latitude, longitude }, distance_km }`
    - _Requirements: 8.2, 8.3, 8.4, 3.3, 3.4_

  - [ ] 11.5 Map failure paths to status codes: 404 for an unresolved market or no branch in range, 422 for an incomplete matched record, 503 for geocoding unreachable/rate-limited
    - _Requirements: 2.6, 2.7, 3.6_

  - [ ]* 11.6 Write property test for response schema completeness with accurate coordinate source
    - **Property 7: Response schema completeness with accurate coordinate source**
    - **Validates: Requirements 8.2, 8.3, 3.3**

  - [ ]* 11.7 Write property test for the authoritative branch identifier invariant
    - **Property 8: Authoritative branch identifier invariant**
    - **Validates: Requirements 1.4, 3.4, 4.2, 8.4**

  - [ ]* 11.8 Write unit tests for endpoint error responses covering 400 (blank/missing q), 404 (market not found), 404 (no branch in range), 422 (incomplete record), and 503 (geocoding unreachable/rate-limited)
    - _Requirements: 8.5, 2.6, 2.2, 3.6, 2.7_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Rework frontend Smart Find handler and map visualization
  - [ ] 13.1 Update `runSmartFind()` in `public/app.js` to parse the new response schema (`coords`, `coords_source`, `pickup_branch`, `distance_km`), removing references to `found_coords`/`nearest_post_office`
    - _Requirements: 8.3, 8.4_

  - [ ] 13.2 Implement a `formatDistanceKm(distance)` helper producing `"12.34 km"` formatting and use it wherever distance is displayed
    - _Requirements: 4.3_

  - [ ]* 13.3 Write property test for distance formatting
    - **Property 10: Distance formatting**
    - **Validates: Requirements 4.3**

  - [ ] 13.4 Render a blue marker at `coords` with a popup showing `resolved_market`
    - _Requirements: 7.1_

  - [ ] 13.5 Render a red marker at the pickup branch's latitude/longitude with a popup showing `pickup_branch.branch_id`
    - _Requirements: 7.2, 7.5_

  - [ ] 13.6 Draw a dashed polyline (Leaflet `L.polyline` with `dashArray`) between the blue and red markers
    - _Requirements: 7.3_

  - [ ] 13.7 Fit the map viewport to bounds containing both markers with padding
    - _Requirements: 7.4_

- [ ] 14. Update sidebar detail card for pickup branch results
  - [ ] 14.1 Update `public/index.html` detail card markup to include fields for `branch_id`, `province_kh`, `district_en`, `district_kh`, coordinates, and distance
    - _Requirements: 9.1_

  - [ ] 14.2 Implement `showPickupBranchDetail(result)` in `public/app.js` populating the detail card with the searched market name (title), `pickup_branch.branch_id` prominently, province, district (EN + KH), coordinates, and a labeled `"Distance: 12.34 km"`
    - _Requirements: 4.1, 4.4, 9.1, 9.2_

  - [ ] 14.3 Add an "Open in Google Maps" link for the pickup branch that opens in a new tab using the pickup branch's latitude/longitude
    - _Requirements: 9.3_

  - [ ] 14.4 Implement "Back to list" behavior returning to the standard search results view
    - _Requirements: 9.4_

  - [ ] 14.5 Style the detail card and the blue market pin / dashed line in `public/style.css` with a distinct visual treatment for pickup-branch results
    - _Requirements: 7.1, 7.3_

  - [ ]* 14.6 Write DOM/unit tests asserting the blue market pin, red pickup-branch pin, dashed connecting line, popup contents, detail-card fields, "Open in Google Maps" link uses `target="_blank"`, "Back to list" behavior, and that the legacy `routes.json` `branch_id` is never rendered
    - _Requirements: 4.2, 4.4, 7.1, 7.2, 7.3, 7.4, 7.5, 9.1, 9.2, 9.3, 9.4_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP; they are not implemented by the coding agent per workflow rules.
- Each task references specific requirement clauses for traceability.
- Checkpoints ensure incremental validation between task groups.
- Property tests (using `fast-check`, minimum 100 iterations each) validate the 14 universal correctness properties defined in `design.md`; unit/integration/DOM tests validate specific examples, error paths, and UI rendering.
- The legacy `routes.json` `branch_id` field must never appear in the API response or the UI — this is enforced by Property 8 and the DOM assertions in task 14.6.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4", "4.5", "5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["5.3"] },
    { "id": 7, "tasks": ["5.4", "5.5", "7.1"] },
    { "id": 8, "tasks": ["7.2"] },
    { "id": 9, "tasks": ["7.3"] },
    { "id": 10, "tasks": ["7.4", "8.1"] },
    { "id": 11, "tasks": ["8.2"] },
    { "id": 12, "tasks": ["8.3", "8.4", "10.1"] },
    { "id": 13, "tasks": ["10.2", "10.3"] },
    { "id": 14, "tasks": ["10.4", "10.5", "11.1"] },
    { "id": 15, "tasks": ["11.2", "11.3"] },
    { "id": 16, "tasks": ["11.4"] },
    { "id": 17, "tasks": ["11.5"] },
    { "id": 18, "tasks": ["11.6", "11.7", "11.8", "13.1", "14.1"] },
    { "id": 19, "tasks": ["13.2"] },
    { "id": 20, "tasks": ["14.2", "13.3"] },
    { "id": 21, "tasks": ["13.4"] },
    { "id": 22, "tasks": ["14.3"] },
    { "id": 23, "tasks": ["14.4"] },
    { "id": 24, "tasks": ["13.5"] },
    { "id": 25, "tasks": ["13.6"] },
    { "id": 26, "tasks": ["13.7", "14.5"] },
    { "id": 27, "tasks": ["14.6"] }
  ]
}
```
