/**
 * ENRICH PICKUP BRANCHES WITH 12KM MATCHED KEYWORDS & PLACES
 * Scans all 650 pickup branches and calculates all location keywords,
 * markets, villages, communes, and aliases within 12km radius.
 *
 * Outputs:
 * - data/pickup_branches_with_keywords.json
 * - data/pickup_branches_keywords_mapped.csv
 */

const fs = require('fs');
const path = require('path');
const spatialIndexer = require('../lib/spatial_branch_indexer');

const DATA_DIR = path.join(__dirname, '..', 'data');
const branchesPath = path.join(DATA_DIR, 'pickup_branches.json');
const routesPath = path.join(DATA_DIR, 'routes.json');
const famousPath = path.join(DATA_DIR, 'famous_markets.json');
const landmarksPath = path.join(DATA_DIR, 'curated_landmarks.json');

const jsonOutputPath = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const csvOutputPath = path.join(DATA_DIR, 'pickup_branches_keywords_mapped.csv');

const branches = JSON.parse(fs.readFileSync(branchesPath, 'utf-8'));
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
const famous = fs.existsSync(famousPath) ? JSON.parse(fs.readFileSync(famousPath, 'utf-8')) : [];
const landmarks = fs.existsSync(landmarksPath) ? JSON.parse(fs.readFileSync(landmarksPath, 'utf-8')) : [];

const allLocations = [...routes, ...famous, ...landmarks];

console.log('=== ENRICHING PICKUP BRANCHES WITH 12KM SPATIAL KEYWORDS ===');
console.log(`- Scanned ${branches.length} pickup branches`);
console.log(`- Scanned ${allLocations.length} locations/markets`);

const enrichedBranches = branches.map(b => {
  if (!b.store_code) return b;

  const spatialInfo = spatialIndexer.findLocationsForBranch(
    b.store_code,
    allLocations,
    branches,
    12.0
  );

  const keywordSet = new Set();
  if (b.store_code) keywordSet.add(b.store_code.trim());
  if (b.store_name) keywordSet.add(b.store_name.trim());
  if (b.district_en) keywordSet.add(b.district_en.trim());
  if (b.district_kh) keywordSet.add(b.district_kh.trim());
  if (b.province_kh) keywordSet.add(b.province_kh.trim());

  if (spatialInfo.search_keywords_12km) {
    spatialInfo.search_keywords_12km.forEach(k => keywordSet.add(k));
  }

  const allKeywords = Array.from(keywordSet);

  return {
    store_code: b.store_code,
    store_name: b.store_name,
    province_kh: b.province_kh || '',
    district_en: b.district_en || '',
    district_kh: b.district_kh || '',
    latitude: b.latitude || null,
    longitude: b.longitude || null,
    raw_delivery_store: b.raw_delivery_store || `${b.store_code} - ${b.store_name}`,
    total_matched_places_12km: spatialInfo.total_locations_under_12km,
    total_matched_keywords_12km: allKeywords.length,
    matched_keywords_12km: allKeywords,
    matched_places_12km: spatialInfo.related_locations_12km
  };
});

// 1. Save JSON
fs.writeFileSync(jsonOutputPath, JSON.stringify(enrichedBranches, null, 2), 'utf-8');
console.log(`✅ Saved full JSON database to: ${jsonOutputPath}`);

// 2. Generate CSV
let csv = "sep=,\r\n";
csv += "Store_Code,Store_Name,Province_Khmer,District_EN,District_Khmer,Latitude,Longitude,Matched_Places_Count,Matched_Keywords_12KM\r\n";

enrichedBranches.forEach(b => {
  const code = (b.store_code || '').replace(/"/g, '""');
  const name = (b.store_name || '').replace(/"/g, '""');
  const prov = (b.province_kh || '').replace(/"/g, '""');
  const distEn = (b.district_en || '').replace(/"/g, '""');
  const distKh = (b.district_kh || '').replace(/"/g, '""');
  const lat = b.latitude || '';
  const lng = b.longitude || '';
  const count = b.total_matched_places_12km || 0;
  const keywords = (b.matched_keywords_12km || []).join(' | ').replace(/"/g, '""');

  csv += `"${code}","${name}","${prov}","${distEn}","${distKh}","${lat}","${lng}",${count},"${keywords}"\r\n`;
});

fs.writeFileSync(csvOutputPath, csv, 'utf-8');
console.log(`✅ Saved Excel-compatible CSV to: ${csvOutputPath}`);
console.log('=== ENRICHMENT COMPLETE ===');
