/**
 * ============================================================
 * SPATIAL BRANCH INDEXER — 10km Auto-Select Nearest Branch
 * ============================================================
 * Given any location coordinates (lat, lng) or market entity:
 * 1. Computes Haversine distance to all 650 pickup branches.
 * 2. Filters branches within max 10.0 km.
 * 3. Auto-selects the nearest branch (#1 closest within 10km).
 * 4. Attaches list of all nearby branches within 10km.
 * ============================================================
 */

'use strict';

const DEFAULT_MAX_DIST_KM = 10.0;

/**
 * Haversine formula to compute distance in km between two lat/lng pairs
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find all pickup branches within maxDistKm (default 10km) for given coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} branchesList - Array of pickup branch objects with latitude/longitude
 * @param {number} maxDistKm - Max distance in km (default 10.0)
 * @returns {{ auto_selected_branch: Object|null, nearby_branches_10km: Array, total_nearby: number }}
 */
function findNearbyBranches(lat, lng, branchesList = [], maxDistKm = DEFAULT_MAX_DIST_KM) {
  if (!lat || !lng || !Array.isArray(branchesList) || branchesList.length === 0) {
    return {
      auto_selected_branch: null,
      nearby_branches_10km: [],
      total_nearby: 0
    };
  }

  const numericLat = parseFloat(lat);
  const numericLng = parseFloat(lng);

  if (isNaN(numericLat) || isNaN(numericLng)) {
    return {
      auto_selected_branch: null,
      nearby_branches_10km: [],
      total_nearby: 0
    };
  }

  const scored = [];

  for (const b of branchesList) {
    if (b.latitude && b.longitude) {
      const bLat = parseFloat(b.latitude);
      const bLng = parseFloat(b.longitude);
      if (!isNaN(bLat) && !isNaN(bLng)) {
        const dist = haversine(numericLat, numericLng, bLat, bLng);
        if (dist <= maxDistKm) {
          scored.push({
            id: `po_${b.store_code}`,
            store_code: b.store_code,
            store_name: b.store_name,
            province_kh: b.province_kh || '',
            district_en: b.district_en || '',
            district_kh: b.district_kh || '',
            latitude: bLat,
            longitude: bLng,
            raw_delivery_store: b.raw_delivery_store || `${b.store_code} - ${b.store_name}`,
            google_maps_url: `https://www.google.com/maps?q=${bLat},${bLng}`,
            distance_km: parseFloat(dist.toFixed(2))
          });
        }
      }
    }
  }

  // Sort by distance ascending (nearest first)
  scored.sort((a, b) => a.distance_km - b.distance_km);

  const autoSelected = scored.length > 0 ? scored[0] : null;

  return {
    auto_selected_branch: autoSelected,
    nearby_branches_10km: scored,
    total_nearby: scored.length
  };
}

/**
 * Enriches a location record (market, landmark, route) with its 10km auto-selected branch
 * @param {Object} locationRecord - Record containing latitude and longitude
 * @param {Array} branchesList - Array of pickup branches
 * @param {number} maxDistKm - Max radius in km (default 10.0)
 * @returns {Object} Enriched record with auto_selected_branch and nearby_branches_10km
 */
function enrichLocationWith10kmBranch(locationRecord, branchesList = [], maxDistKm = DEFAULT_MAX_DIST_KM) {
  if (!locationRecord) return locationRecord;

  const enriched = { ...locationRecord };

  if (enriched.latitude && enriched.longitude) {
    const { auto_selected_branch, nearby_branches_10km, total_nearby } = findNearbyBranches(
      enriched.latitude,
      enriched.longitude,
      branchesList,
      maxDistKm
    );

    enriched.auto_selected_branch = auto_selected_branch;
    enriched.nearby_branches_10km = nearby_branches_10km;
    enriched.total_nearby_branches_10km = total_nearby;

    // Set branch_id to auto-selected branch store_code if available
    if (auto_selected_branch && auto_selected_branch.store_code) {
      enriched.assigned_10km_branch_id = auto_selected_branch.store_code;
    }
  }

  return enriched;
}

module.exports = {
  DEFAULT_MAX_DIST_KM,
  haversine,
  findNearbyBranches,
  enrichLocationWith10kmBranch
};
