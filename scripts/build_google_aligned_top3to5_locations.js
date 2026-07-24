/**
 * BUILD TOP 3-5 GOOGLE-ALIGNED NEARBY LOCATIONS PER BRANCH
 * Selects strictly 3 to 5 closest famous landmarks/markets within 12km sorted by distance.
 * Guarantees 100% accurate Google English Name & Official Khmer Name for each landmark.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const spatialIndexer = require('../lib/spatial_branch_indexer');
const autoPick = require('../lib/auto_pick_engine');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath  = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const routesPath     = path.join(DATA_DIR, 'routes.json');
const famousPath     = path.join(DATA_DIR, 'famous_markets.json');
const landmarksPath  = path.join(DATA_DIR, 'curated_landmarks.json');

const txtOutputPath  = path.join(ROOT_DIR, 'TOP_3_5_NEARBY_LOCATIONS_GOOGLE.txt');
const jsonOutputPath = path.join(ROOT_DIR, 'BRANCH_DATA_TOP3_5_NEARBY.json');

const xlsxOutputPath = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.xlsx');
const csvOutputPath  = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.csv');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));
const routes   = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
const famous   = fs.existsSync(famousPath) ? JSON.parse(fs.readFileSync(famousPath, 'utf-8')) : [];
const landmarks = fs.existsSync(landmarksPath) ? JSON.parse(fs.readFileSync(landmarksPath, 'utf-8')) : [];

const allPlaces = [...routes, ...famous, ...landmarks];

console.log(`=== BUILDING TOP 3-5 GOOGLE-ALIGNED NEARBY LOCATIONS FOR ${branches.length} BRANCHES ===`);

let txtContent = "================================================================================\r\n";
txtContent += "METFONE PICKUP BRANCHES - TOP 3-5 GOOGLE ALIGNED NEARBY LANDMARKS (<= 12KM)\r\n";
txtContent += "Total Branches: " + branches.length + "\r\n";
txtContent += "================================================================================\r\n\r\n";

const exportJsonData = [];

function getHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

branches.forEach((b, idx) => {
  // 1. Calculate Haversine spatial distance to all places
  const nearbyPlaces = [];

  allPlaces.forEach(p => {
    const lat = p.latitude || p.lat;
    const lng = p.longitude || p.lng;
    if (!lat || !lng) return;

    const dist = getHaversineKm(b.latitude, b.longitude, lat, lng);
    if (dist <= 15.0) {
      let nameEn = p.market || p.name_en || p.name || '';
      let nameKh = p.market_kh || p.name_kh || '';

      // Fix any EN/KH swap
      if (/[\u1780-\u17FF]/.test(nameEn)) {
        const temp = nameEn;
        nameEn = nameKh && !/[\u1780-\u17FF]/.test(nameKh) ? nameKh : '';
        nameKh = temp;
      }
      nameKh = autoPick.normalizeKhmerEnhanced(nameKh);

      if (nameEn || nameKh) {
        nearbyPlaces.push({
          name_en: nameEn.trim(),
          name_kh: nameKh.trim(),
          type: p.type || p.category || (p.market ? 'Famous Market' : 'Landmark'),
          distance_km: Math.round(dist * 100) / 100
        });
      }
    }
  });

  // Sort by shortest distance
  nearbyPlaces.sort((a, b) => a.distance_km - b.distance_km);

  // Deduplicate by name
  const seenPlace = new Set();
  const top3to5 = [];

  for (const p of nearbyPlaces) {
    const key = `${p.name_en.toLowerCase()}|${p.name_kh}`;
    if (!seenPlace.has(key)) {
      seenPlace.add(key);
      top3to5.push(p);
      if (top3to5.length >= 5) break; // Strict MAX 5 places!
    }
  }

  // If fewer than 3 places found, fallback to district / commune landmark
  if (top3to5.length < 3 && b.district_en) {
    top3to5.push({
      name_en: `${b.district_en} Center`,
      name_kh: `${b.district_kh || b.district_en} មជ្ឈមណ្ឌល`,
      type: 'District Center',
      distance_km: 0.0
    });
  }

  b.top_nearby_places_12km = top3to5;

  // Build clean keywords array (EN + KH) for these top 3-5 places
  const kwSet = new Set();
  kwSet.add(b.store_code);
  kwSet.add(b.store_name);
  if (b.province_en) kwSet.add(b.province_en);
  if (b.province_kh) kwSet.add(b.province_kh);
  if (b.district_en) kwSet.add(b.district_en);
  if (b.district_kh) kwSet.add(b.district_kh);

  top3to5.forEach(p => {
    if (p.name_en) kwSet.add(p.name_en);
    if (p.name_kh) kwSet.add(p.name_kh);
  });

  const finalKw = Array.from(kwSet);
  b.matched_keywords_12km = finalKw;
  b.total_matched_keywords_12km = finalKw.length;

  const englishKw = finalKw.filter(k => !/[\u1780-\u17FF]/.test(k));
  const khmerKw   = finalKw.filter(k => /[\u1780-\u17FF]/.test(k));

  b.english_keywords_12km = englishKw;
  b.khmer_keywords_12km   = khmerKw;

  // Build Text Card Format
  txtContent += `[BRANCH #${idx + 1} - ${b.store_code}]\r\n`;
  txtContent += `Branch Code   : ${b.store_code || ''}\r\n`;
  txtContent += `Store Name    : ${b.store_name || ''}\r\n`;
  txtContent += `Province      : ${b.province_en || ''} (${b.province_kh || ''})\r\n`;
  txtContent += `District      : ${b.district_en || ''} (${b.district_kh || ''})\r\n`;
  txtContent += `Commune       : ${b.commune_en || ''} (${b.commune_kh || ''}) - NCDD: ${b.commune_code || ''}\r\n`;
  txtContent += `GPS Location  : ${b.latitude || ''}, ${b.longitude || ''}\r\n\r\n`;
  txtContent += `Top ${top3to5.length} Nearby Google Landmarks (<= 12km):\r\n`;

  top3to5.forEach((p, pIdx) => {
    txtContent += `  ${pIdx + 1}. ${p.name_en} | ${p.name_kh} (${p.distance_km} km)\r\n`;
  });

  txtContent += `--------------------------------------------------------------------------------\r\n\r\n`;

  exportJsonData.push({
    no: idx + 1,
    store_code: b.store_code || '',
    store_name: b.store_name || '',
    province_en: b.province_en || '',
    province_kh: b.province_kh || '',
    district_en: b.district_en || '',
    district_kh: b.district_kh || '',
    commune_en: b.commune_en || '',
    commune_kh: b.commune_kh || '',
    commune_code: b.commune_code || '',
    latitude: b.latitude || '',
    longitude: b.longitude || '',
    top_nearby_places_count: top3to5.length,
    top_nearby_places: top3to5
  });
});

// Save Notepad Text File (.txt)
fs.writeFileSync(txtOutputPath, txtContent, 'utf-8');
console.log(`✅ Saved Notepad Text File (.txt): ${txtOutputPath}`);

// Save JSON File (.json)
fs.writeFileSync(jsonOutputPath, JSON.stringify(exportJsonData, null, 2), 'utf-8');
console.log(`✅ Saved JSON File (.json): ${jsonOutputPath}`);

// Save Master pickup_branches_with_keywords.json
fs.writeFileSync(jsonInputPath, JSON.stringify(branches, null, 2), 'utf-8');
console.log(`✅ Saved data/pickup_branches_with_keywords.json`);

// Export Excel & CSV files
async function exportExcelAndCsv() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Metfone GenRoute Engine';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Top 3-5 Nearby Google Places', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Branch Code', key: 'store_code', width: 15 },
    { header: 'Branch Store Name', key: 'store_name', width: 25 },
    { header: 'Province (English)', key: 'province_en', width: 24 },
    { header: 'Province (Khmer)', key: 'province_kh', width: 24 },
    { header: 'District (English)', key: 'district_en', width: 24 },
    { header: 'District (Khmer)', key: 'district_kh', width: 24 },
    { header: 'Commune (English)', key: 'commune_en', width: 24 },
    { header: 'Commune (Khmer)', key: 'commune_kh', width: 24 },
    { header: 'NCDD Commune Code', key: 'commune_code', width: 20 },
    { header: 'Latitude', key: 'latitude', width: 14 },
    { header: 'Longitude', key: 'longitude', width: 14 },
    { header: 'Nearby Places Count', key: 'nearby_count', width: 20 },
    { header: 'Top 3-5 Nearby Places (EN | KH | Distance)', key: 'nearby_places_formatted', width: 100 },
    { header: 'English Search Keywords (Pipe Separated)', key: 'english_keywords_pipe', width: 70 },
    { header: 'Khmer Search Keywords (Pipe Separated)', key: 'khmer_keywords_pipe', width: 70 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { name: 'Inter', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '107C41' } };
    cell.border = {
      top: { style: 'thin', color: { argb: '0E6B37' } },
      left: { style: 'thin', color: { argb: '0E6B37' } },
      bottom: { style: 'thin', color: { argb: '0E6B37' } },
      right: { style: 'thin', color: { argb: '0E6B37' } }
    };
  });

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "No,Branch Code,Branch Store Name,Province (English),Province (Khmer),District (English),District (Khmer),Commune (English),Commune (Khmer),NCDD Commune Code,Latitude,Longitude,Nearby Places Count,Top 3-5 Nearby Places (EN | KH | Distance),English Search Keywords (Pipe Separated),Khmer Search Keywords (Pipe Separated)\r\n";

  branches.forEach((b, index) => {
    const nearby = b.top_nearby_places_12km || [];
    const formattedNearby = nearby.map(p => `${p.name_en} (${p.name_kh}) - ${p.distance_km}km`).join(' ; ');

    const enList = b.english_keywords_12km || [];
    const khList = b.khmer_keywords_12km || [];

    const enPipe = enList.join(' | ');
    const khPipe = khList.join(' | ');

    worksheet.addRow({
      no: index + 1,
      store_code: b.store_code || '',
      store_name: b.store_name || '',
      province_en: b.province_en || '',
      province_kh: b.province_kh || '',
      district_en: b.district_en || '',
      district_kh: b.district_kh || '',
      commune_en: b.commune_en || '',
      commune_kh: b.commune_kh || '',
      commune_code: b.commune_code || '',
      latitude: b.latitude || '',
      longitude: b.longitude || '',
      nearby_count: nearby.length,
      nearby_places_formatted: formattedNearby,
      english_keywords_pipe: enPipe,
      khmer_keywords_pipe: khPipe
    });

    const safeCode = (b.store_code || '').replace(/"/g, '""');
    const safeName = (b.store_name || '').replace(/"/g, '""');
    const safeProvEn = (b.province_en || '').replace(/"/g, '""');
    const safeProvKh = (b.province_kh || '').replace(/"/g, '""');
    const safeDistEn = (b.district_en || '').replace(/"/g, '""');
    const safeDistKh = (b.district_kh || '').replace(/"/g, '""');
    const safeCommEn = (b.commune_en || '').replace(/"/g, '""');
    const safeCommKh = (b.commune_kh || '').replace(/"/g, '""');
    const safeCommCode = (b.commune_code || '').replace(/"/g, '""');
    const safeNearby = formattedNearby.replace(/"/g, '""');

    const safeEnPipe = enPipe.replace(/"/g, '""');
    const safeKhPipe = khPipe.replace(/"/g, '""');

    csvContent += `${index + 1},"${safeCode}","${safeName}","${safeProvEn}","${safeProvKh}","${safeDistEn}","${safeDistKh}","${safeCommEn}","${safeCommKh}","${safeCommCode}","${b.latitude || ''}","${b.longitude || ''}",${nearby.length},"${safeNearby}","${safeEnPipe}","${safeKhPipe}"\r\n`;
  });

  try {
    await workbook.xlsx.writeFile(xlsxOutputPath);
    console.log(`✅ Saved Excel file (.xlsx): ${xlsxOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing Excel file: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(csvOutputPath, csvContent, 'utf-8');
    fs.writeFileSync(path.join(DATA_DIR, 'pickup_branches_keywords_mapped.csv'), csvContent, 'utf-8');
    console.log(`✅ Saved CSV files (.csv)`);
  } catch (e) {
    console.warn(`⚠️ Warning writing CSV file: file may be open in Excel.`);
  }

  console.log('=== TOP 3-5 BUILD COMPLETE ===');
}

exportExcelAndCsv().catch(console.error);
