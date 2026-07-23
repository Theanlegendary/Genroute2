/**
 * Pre-computes 10km nearest branch mappings for all market and location entries
 * Outputs to data/precomputed_10km_branches.json
 */

const fs = require('fs');
const path = require('path');
const spatialIndexer = require('../lib/spatial_branch_indexer');

const DATA_DIR = path.join(__dirname, '..', 'data');
const routesPath = path.join(DATA_DIR, 'routes.json');
const branchesPath = path.join(DATA_DIR, 'pickup_branches.json');
const famousPath = path.join(DATA_DIR, 'famous_markets.json');
const landmarksPath = path.join(DATA_DIR, 'curated_landmarks.json');
const outputPath = path.join(DATA_DIR, 'precomputed_10km_branches.json');

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
const branches = JSON.parse(fs.readFileSync(branchesPath, 'utf-8'));
const famous = fs.existsSync(famousPath) ? JSON.parse(fs.readFileSync(famousPath, 'utf-8')) : [];
const landmarks = fs.existsSync(landmarksPath) ? JSON.parse(fs.readFileSync(landmarksPath, 'utf-8')) : [];

const allLocations = [...routes, ...famous, ...landmarks];
const indexMap = {};

let totalLocations = 0;
let matchedCount = 0;

allLocations.forEach(loc => {
  if (!loc.latitude || !loc.longitude) return;
  totalLocations++;

  const key = `${loc.market || loc.name || loc.id}||${loc.province_kh || loc.province || ''}`;
  const enriched = spatialIndexer.enrichLocationWith10kmBranch(loc, branches, 10.0);

  if (enriched.auto_selected_branch) {
    matchedCount++;
    indexMap[key] = {
      market: loc.market || loc.name || '',
      market_kh: loc.market_kh || loc.name_kh || '',
      province_kh: loc.province_kh || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      auto_selected_branch: enriched.auto_selected_branch,
      nearby_branches_10km: enriched.nearby_branches_10km,
      total_nearby: enriched.total_nearby_branches_10km
    };
  }
});

fs.writeFileSync(outputPath, JSON.stringify(indexMap, null, 2), 'utf-8');

console.log(`✅ Successfully generated 10km precomputed spatial index:`);
console.log(`  - Total location entries scanned: ${totalLocations}`);
console.log(`  - Entries with nearest branch <= 10km: ${matchedCount}`);
console.log(`  - Coverage: ${((matchedCount / totalLocations) * 100).toFixed(1)}%`);
console.log(`  - Saved to: ${outputPath}`);
