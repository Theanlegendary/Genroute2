/**
 * SEPARATE COMMON TOKENS INTO A RELATIONAL LOOKUP TABLE
 * 1. Creates LOCATIONS_RELATIONAL_LOOKUP.json (Central Master Location Table with unique location_ref IDs)
 * 2. Creates BRANCH_RELATIONAL_PROFILES.json (Branch Profiles linking to location_refs array instead of repeating raw string blocks)
 * 3. Creates RELATIONAL_SCHEMA_SUMMARY.txt (Human-readable text file & Notepad output with schema explanation)
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath  = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const routesPath     = path.join(DATA_DIR, 'routes.json');
const famousPath     = path.join(DATA_DIR, 'famous_markets.json');
const landmarksPath  = path.join(DATA_DIR, 'curated_landmarks.json');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
const famous = fs.existsSync(famousPath) ? JSON.parse(fs.readFileSync(famousPath, 'utf-8')) : [];
const landmarks = fs.existsSync(landmarksPath) ? JSON.parse(fs.readFileSync(landmarksPath, 'utf-8')) : [];

console.log('=== BUILDING RELATIONAL LOCATION LOOKUP MASTER TABLE ===');

const allPlaces = [...routes, ...famous, ...landmarks];

// 1. Build Location Master Lookup Table (Relational Entity Map)
const locationMasterMap = new Map(); // norm_key -> location_ref object
let locIdCounter = 1;

function getOrCreateLocationRef(nameEn, nameKh, type, lat, lng) {
  const normKey = `${(nameEn || '').toLowerCase().trim()}|${(nameKh || '').trim()}`;
  if (!normKey || normKey === '|') return null;

  if (locationMasterMap.has(normKey)) {
    return locationMasterMap.get(normKey).location_id;
  }

  const locId = `LOC_${String(locIdCounter++).padStart(4, '0')}`;
  const locObj = {
    location_id: locId,
    name_en: nameEn || '',
    name_kh: nameKh || '',
    type: type || 'Landmark',
    latitude: lat || null,
    longitude: lng || null,
    keywords: Array.from(new Set([nameEn, nameKh].filter(Boolean)))
  };

  locationMasterMap.set(normKey, locObj);
  return locId;
}

// Populate Location Master from all famous markets, landmarks, and routes
allPlaces.forEach(p => {
  const nameEn = p.market || p.name_en || p.name || '';
  const nameKh = p.market_kh || p.name_kh || '';
  const type   = p.type || p.category || (p.market ? 'Famous Market' : 'Landmark');
  if (nameEn || nameKh) {
    getOrCreateLocationRef(nameEn, nameKh, type, p.latitude || p.lat, p.longitude || p.lng);
  }
});

console.log(`✅ Extracted ${locationMasterMap.size} Unique Location Reference Master Entities`);

// Convert Location Map to Object
const locationMasterObject = {};
locationMasterMap.forEach((val) => {
  locationMasterObject[val.location_id] = val;
});

// 2. Build Relational Branch Profiles (Linking by location_ref IDs)
const relationalBranchProfiles = [];

branches.forEach(b => {
  const locationRefIds = new Set();

  // Find linked location references from branch matched places
  if (b.matched_places_12km && Array.isArray(b.matched_places_12km)) {
    b.matched_places_12km.forEach(p => {
      const nameEn = p.market || p.name_en || p.name || '';
      const nameKh = p.market_kh || p.name_kh || '';
      const refId = getOrCreateLocationRef(nameEn, nameKh, p.type || 'Famous Market', p.latitude, p.longitude);
      if (refId) locationRefIds.add(refId);
    });
  }

  relationalBranchProfiles.push({
    store_code: b.store_code || '',
    store_name: b.store_name || '',
    province_kh: b.province_kh || '',
    district_en: b.district_en || '',
    district_kh: b.district_kh || '',
    commune_kh: b.commune_kh || '',
    commune_code: b.commune_code || '',
    latitude: b.latitude || '',
    longitude: b.longitude || '',
    location_refs_count: locationRefIds.size,
    location_refs: Array.from(locationRefIds) // Array of foreign key IDs e.g. ["LOC_0012", "LOC_0045"]
  });
});

console.log(`✅ Linked ${relationalBranchProfiles.length} Relational Branch Profiles`);

// Save Relational JSON Files
const locMasterPath = path.join(DATA_DIR, 'locations_master_lookup.json');
const branchRelPath = path.join(DATA_DIR, 'branches_relational_profiles.json');
const summaryTxtPath = path.join(ROOT_DIR, 'RELATIONAL_LOOKUP_SCHEMA.txt');

fs.writeFileSync(locMasterPath, JSON.stringify(locationMasterObject, null, 2), 'utf-8');
fs.writeFileSync(branchRelPath, JSON.stringify(relationalBranchProfiles, null, 2), 'utf-8');

console.log(`✅ Saved data/locations_master_lookup.json`);
console.log(`✅ Saved data/branches_relational_profiles.json`);

// 3. Create Human-Readable Summary & Demonstration File
let summaryTxt = "================================================================================\r\n";
summaryTxt += "RELATIONAL LOCATION LOOKUP ARCHITECTURE (NORMALIZED TOKENS & REFERENTIAL INTEGRITY)\r\n";
summaryTxt += "================================================================================\r\n\r\n";

summaryTxt += "SCHEMA OVERVIEW:\r\n";
summaryTxt += "1. Locations Master Table (data/locations_master_lookup.json):\r\n";
summaryTxt += "   Central lookup table storing unique famous places, markets, and landmarks with Location Ref IDs (LOC_xxxx).\r\n\r\n";
summaryTxt += "2. Branch Relational Profiles (data/branches_relational_profiles.json):\r\n";
summaryTxt += "   Clean branch profile rows storing only foreign key Location Ref IDs instead of repeating raw string blocks.\r\n\r\n";
summaryTxt += "--------------------------------------------------------------------------------\r\n";
summaryTxt += "RELATIONAL LOOKUP EXAMPLE (BRANCH BANA002 - PAOY PAET):\r\n";
summaryTxt += "--------------------------------------------------------------------------------\r\n\r\n";

const sampleBranch = relationalBranchProfiles.find(b => b.store_code === 'BANA002');
summaryTxt += `[BRANCH PROFILE: ${sampleBranch.store_code}]\r\n`;
summaryTxt += `Code          : ${sampleBranch.store_code}\r\n`;
summaryTxt += `Name          : ${sampleBranch.store_name}\r\n`;
summaryTxt += `Province      : ${sampleBranch.province_kh}\r\n`;
summaryTxt += `District      : ${sampleBranch.district_en} (${sampleBranch.district_kh})\r\n`;
summaryTxt += `Commune       : ${sampleBranch.commune_kh} (Code: ${sampleBranch.commune_code})\r\n`;
summaryTxt += `Coordinates   : ${sampleBranch.latitude}, ${sampleBranch.longitude}\r\n`;
summaryTxt += `Location Refs : [ ${sampleBranch.location_refs.slice(0, 8).join(', ')} ... (${sampleBranch.location_refs_count} total) ]\r\n\r\n`;

summaryTxt += `RESOLVED RELATIONAL ENTITIES (JOINED FROM MASTER LOOKUP TABLE):\r\n`;
sampleBranch.location_refs.slice(0, 8).forEach(refId => {
  const loc = locationMasterObject[refId];
  if (loc) {
    summaryTxt += `  - ${loc.location_id} -> ${loc.name_en} | ${loc.name_kh} (${loc.type}) [GPS: ${loc.latitude}, ${loc.longitude}]\r\n`;
  }
});

summaryTxt += "\r\n--------------------------------------------------------------------------------\r\n";
summaryTxt += "RELATIONAL MASTER LOOKUP TABLE SAMPLE (FIRST 10 LOCATION ENTITIES):\r\n";
summaryTxt += "--------------------------------------------------------------------------------\r\n\r\n";

Object.keys(locationMasterObject).slice(0, 10).forEach(key => {
  const loc = locationMasterObject[key];
  summaryTxt += `${loc.location_id} : ${loc.name_en} | ${loc.name_kh} | Type: ${loc.type}\r\n`;
});

fs.writeFileSync(summaryTxtPath, summaryTxt, 'utf-8');
console.log(`✅ Saved RELATIONAL_LOOKUP_SCHEMA.txt: ${summaryTxtPath}`);

console.log('=== RELATIONAL BUILD COMPLETE ===');
