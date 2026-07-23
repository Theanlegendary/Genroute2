/**
 * ================================================================
 * SPATIAL BRANCH INDEXER — 10km Auto-Select Integration Test
 * ================================================================
 * Demonstrates:
 * 1. Searching for any location / market
 * 2. Auto-enriching with the 10km nearest pickup branch
 * 3. Showing all surrounding pickup branches within max 10km
 * ================================================================
 */

const spatialIndexer = require('../lib/spatial_branch_indexer');
const routes = require('../data/routes.json');
const branches = require('../data/pickup_branches.json');
const famousMarkets = require('../data/famous_markets.json');

console.log('=== 10KM SPATIAL BRANCH AUTO-SELECTION DEMO ===\n');

// Test Case 1: Phsar Thmei (Central Market Phnom Penh)
const phsarThmei = famousMarkets.find(m => m.market_kh === 'ផ្សារធំថ្មី' || m.market === 'Central Market') || routes[0];
console.log(`📍 Location: ${phsarThmei.market || phsarThmei.name} (${phsarThmei.market_kh || ''})`);
console.log(`   Coords: ${phsarThmei.latitude}, ${phsarThmei.longitude}`);

const result1 = spatialIndexer.enrichLocationWith10kmBranch(phsarThmei, branches, 10.0);

console.log('\n🎯 Auto-Selected Nearest Branch (within 10km):');
if (result1.auto_selected_branch) {
  console.log(`   Branch Code: ${result1.auto_selected_branch.store_code}`);
  console.log(`   Branch Name: ${result1.auto_selected_branch.store_name}`);
  console.log(`   Distance   : ${result1.auto_selected_branch.distance_km} km`);
  console.log(`   Province   : ${result1.auto_selected_branch.province_kh}`);
} else {
  console.log('   No branch within 10km');
}

console.log(`\n📋 All Pickup Branches within 10km radius (${result1.total_nearby_branches_10km} total):`);
result1.nearby_branches_10km.slice(0, 5).forEach((b, idx) => {
  console.log(`   [${idx + 1}] ${b.store_code} - ${b.store_name} (${b.distance_km} km)`);
});

// Test Case 2: Custom GPS Coordinates (e.g. Siem Reap Angkor area)
console.log('\n------------------------------------------------');
const customLat = 13.3633;
const customLng = 103.8564;
console.log(`📍 Custom Coordinate: Lat ${customLat}, Lng ${customLng} (Siem Reap)`);

const result2 = spatialIndexer.findNearbyBranches(customLat, customLng, branches, 10.0);
console.log(`🎯 Auto-Selected Nearest Branch: ${result2.auto_selected_branch ? `${result2.auto_selected_branch.store_code} - ${result2.auto_selected_branch.store_name} (${result2.auto_selected_branch.distance_km} km)` : 'None'}`);
console.log(`📋 Total nearby branches within 10km: ${result2.total_nearby}`);

console.log('\n=== TEST COMPLETE ===');
