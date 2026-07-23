/**
 * UPDATE 700 PICKUP BRANCHES DATASET
 * Parses pickup_branch_lookup.csv (697 branches) and updates data/pickup_branches.json
 * Then triggers 12km spatial keyword enrichment across all ~700 branches.
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'pickup_branch_lookup.csv');
const jsonPath = path.join(__dirname, '..', 'data', 'pickup_branches.json');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\r\n').join('\n').split('\n').filter(l => l.trim());

const full700Branches = [];
const seenCodes = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Split by comma ignoring commas inside quotes
  const cols = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
  const cleanCols = cols.map(c => c.replace(/^\"|\"$/g, '').trim());

  const storeCode = cleanCols[0] || '';
  const communeEn = cleanCols[1] || '';
  const communeKh = cleanCols[2] || '';
  const phone     = cleanCols[3] || '';
  const provCode  = cleanCols[4] || '';
  const provEn    = cleanCols[5] || '';
  const provKh    = cleanCols[6] || '';
  const type      = cleanCols[7] || '';
  const status    = cleanCols[8] || '';
  const lat       = parseFloat(cleanCols[9]) || null;
  const lng       = parseFloat(cleanCols[10]) || null;

  if (storeCode && !seenCodes.has(storeCode)) {
    seenCodes.add(storeCode);
    full700Branches.push({
      store_code: storeCode,
      store_name: communeEn || storeCode,
      commune_kh: communeKh,
      province_kh: provKh || provEn,
      district_en: communeEn,
      district_kh: communeKh,
      province_code: provCode,
      phone: phone,
      type: type,
      status: status,
      latitude: lat,
      longitude: lng,
      raw_delivery_store: `${storeCode} - ${communeEn || storeCode}`
    });
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(full700Branches, null, 2), 'utf-8');

console.log(`✅ Successfully updated data/pickup_branches.json:`);
console.log(`   - Total pickup branches: ${full700Branches.length}`);
console.log(`   - File path: ${jsonPath}`);
