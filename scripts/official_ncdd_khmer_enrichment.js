/**
 * OFFICIAL NCDD KHMER GEOGRAPHY ENRICHMENT SCRIPT
 * Maps all 697 pickup branches against official NCDD Cambodia Geography Database:
 * - 25 Provinces (រាជធានី-ខេត្ត)
 * - 209 Districts / Khans / Krongs (ក្រុង-ស្រុក-ខណ្ឌ)
 * - 1,652 Communes / Sangkats (ឃុំ-សង្កាត់)
 * - 14,570 Villages / Phums (ភូមិ)
 *
 * Populates official NCDD Khmer Province, District, Commune names & 6-digit codes.
 * Re-exports:
 * - data/pickup_branches.json
 * - data/pickup_branches_with_keywords.json
 * - data/pickup_branches_keywords_mapped.csv
 * - all_700_branches_keywords_mapped.xlsx
 * - all_700_branches_keywords_mapped.csv
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const fuzz = require('fuzzball');
const autoPick = require('../lib/auto_pick_engine');
const spatialIndexer = require('../lib/spatial_branch_indexer');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const ncddPath     = path.join(DATA_DIR, 'ncdd_hierarchy.json');
const branchesPath = path.join(DATA_DIR, 'pickup_branches.json');
const routesPath   = path.join(DATA_DIR, 'routes.json');
const famousPath   = path.join(DATA_DIR, 'famous_markets.json');
const landmarksPath= path.join(DATA_DIR, 'curated_landmarks.json');

const jsonOutputPath = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const xlsxOutputPath = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.xlsx');
const csvOutputPath  = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.csv');
const dataCsvOutputPath = path.join(DATA_DIR, 'pickup_branches_keywords_mapped.csv');

const ncdd = JSON.parse(fs.readFileSync(ncddPath, 'utf-8'));
const branches = JSON.parse(fs.readFileSync(branchesPath, 'utf-8'));
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
const famous = fs.existsSync(famousPath) ? JSON.parse(fs.readFileSync(famousPath, 'utf-8')) : [];
const landmarks = fs.existsSync(landmarksPath) ? JSON.parse(fs.readFileSync(landmarksPath, 'utf-8')) : [];

const allLocations = [...routes, ...famous, ...landmarks];

console.log('=== ENRICHING PICKUP BRANCHES WITH OFFICIAL NCDD KHMER GEOGRAPHY ===');

// Flatten NCDD communes
const flatNcdd = [];
ncdd.forEach(p => {
  if (p.districts) {
    p.districts.forEach(d => {
      if (d.communes) {
        d.communes.forEach(c => {
          flatNcdd.push({
            province_code: p.code,
            province_en: p.name_en,
            province_kh: p.name_kh,
            district_code: d.code,
            district_en: d.name_en,
            district_kh: d.name_kh,
            commune_code: c.code,
            commune_en: c.name_en,
            commune_kh: c.name_kh
          });
        });
      }
    });
  }
});

let matchedCount = 0;

const enrichedBranches = branches.map(b => {
  const normProv = autoPick.normalizeKhmerEnhanced(b.province_kh || '');
  const normComm = autoPick.normalizeKhmerEnhanced(b.store_name || b.commune_kh || '');

  // Scope candidates by province first
  let candidates = flatNcdd.filter(c => {
    const cProv = autoPick.normalizeKhmerEnhanced(c.province_en);
    return cProv.includes(normProv) || normProv.includes(cProv);
  });
  if (candidates.length === 0) candidates = flatNcdd;

  // Find best match in NCDD
  let bestMatch = null;
  let bestRatio = 0;

  for (const c of candidates) {
    const cComm = autoPick.normalizeKhmerEnhanced(c.commune_en);
    const cDist = autoPick.normalizeKhmerEnhanced(c.district_en);
    const ratioComm = fuzz.ratio(normComm, cComm);
    const ratioDist = fuzz.ratio(normComm, cDist);
    const maxRatio = Math.max(ratioComm, ratioDist);

    if (maxRatio > bestRatio) {
      bestRatio = maxRatio;
      bestMatch = c;
    }
  }

  const result = { ...b };

  if (bestMatch && bestRatio >= 45) {
    matchedCount++;
    result.province_kh = bestMatch.province_kh;
    result.district_en = bestMatch.district_en;
    result.district_kh = bestMatch.district_kh;
    result.commune_en  = bestMatch.commune_en;
    result.commune_kh  = bestMatch.commune_kh;
    result.commune_code = bestMatch.commune_code;
    result.district_code = bestMatch.district_code;
    result.province_code_ncdd = bestMatch.province_code;
  }

  // 12km Spatial Keywords
  const spatialInfo = spatialIndexer.findLocationsForBranch(
    b.store_code,
    allLocations,
    branches,
    12.0
  );

  const keywordSet = new Set();
  if (result.store_code)  keywordSet.add(result.store_code.trim());
  if (result.store_name)  keywordSet.add(result.store_name.trim());
  if (result.province_kh) keywordSet.add(result.province_kh.trim());
  if (result.district_en) keywordSet.add(result.district_en.trim());
  if (result.district_kh) keywordSet.add(result.district_kh.trim());
  if (result.commune_en)  keywordSet.add(result.commune_en.trim());
  if (result.commune_kh)  keywordSet.add(result.commune_kh.trim());

  if (spatialInfo.search_keywords_12km) {
    spatialInfo.search_keywords_12km.forEach(k => {
      const clean = autoPick.normalizeKhmerEnhanced(k);
      if (clean) keywordSet.add(k.trim());
    });
  }

  const allKeywords = Array.from(keywordSet);

  return {
    ...result,
    total_matched_places_12km: spatialInfo.total_locations_under_12km,
    total_matched_keywords_12km: allKeywords.length,
    matched_keywords_12km: allKeywords,
    matched_places_12km: spatialInfo.related_locations_12km
  };
});

console.log(`✅ Successfully mapped ${matchedCount} / ${branches.length} branches to official NCDD Khmer records (${((matchedCount/branches.length)*100).toFixed(1)}%)`);

// Save pickup_branches.json
fs.writeFileSync(branchesPath, JSON.stringify(enrichedBranches, null, 2), 'utf-8');
console.log(`✅ Saved data/pickup_branches.json`);

// Save pickup_branches_with_keywords.json
fs.writeFileSync(jsonOutputPath, JSON.stringify(enrichedBranches, null, 2), 'utf-8');
console.log(`✅ Saved data/pickup_branches_with_keywords.json`);

// Export Excel and CSV files
async function exportExcelAndCsv() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Metfone GenRoute Engine';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Official NCDD Pickup Branches', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Branch Code', key: 'store_code', width: 15 },
    { header: 'Branch Store Name', key: 'store_name', width: 25 },
    { header: 'Official Province (Khmer)', key: 'province_kh', width: 25 },
    { header: 'Official District (English)', key: 'district_en', width: 24 },
    { header: 'Official District (Khmer)', key: 'district_kh', width: 24 },
    { header: 'Official Commune (Khmer)', key: 'commune_kh', width: 24 },
    { header: 'NCDD Commune Code', key: 'commune_code', width: 20 },
    { header: 'Latitude', key: 'latitude', width: 14 },
    { header: 'Longitude', key: 'longitude', width: 14 },
    { header: 'Matched Locations (<=12km)', key: 'matched_places_count', width: 25 },
    { header: 'Total Keywords', key: 'matched_keywords_count', width: 16 },
    { header: 'All Search Keywords (Pipe Separated)', key: 'keywords_pipe_separated', width: 120 }
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
  csvContent += "No,Branch Code,Branch Store Name,Official Province (Khmer),Official District (English),Official District (Khmer),Official Commune (Khmer),NCDD Commune Code,Latitude,Longitude,Matched Locations (<=12km),Total Keywords,All Search Keywords (Pipe Separated)\r\n";

  enrichedBranches.forEach((b, index) => {
    const kwList = b.matched_keywords_12km || [];
    const pipeKeywords = kwList.join(' | ');

    worksheet.addRow({
      no: index + 1,
      store_code: b.store_code || '',
      store_name: b.store_name || '',
      province_kh: b.province_kh || '',
      district_en: b.district_en || '',
      district_kh: b.district_kh || '',
      commune_kh: b.commune_kh || '',
      commune_code: b.commune_code || '',
      latitude: b.latitude || '',
      longitude: b.longitude || '',
      matched_places_count: b.total_matched_places_12km || 0,
      matched_keywords_count: kwList.length,
      keywords_pipe_separated: pipeKeywords
    });

    const safeCode = (b.store_code || '').replace(/"/g, '""');
    const safeName = (b.store_name || '').replace(/"/g, '""');
    const safeProv = (b.province_kh || '').replace(/"/g, '""');
    const safeDistEn = (b.district_en || '').replace(/"/g, '""');
    const safeDistKh = (b.district_kh || '').replace(/"/g, '""');
    const safeCommKh = (b.commune_kh || '').replace(/"/g, '""');
    const safeCommCode = (b.commune_code || '').replace(/"/g, '""');
    const safeKw = pipeKeywords.replace(/"/g, '""');

    csvContent += `${index + 1},"${safeCode}","${safeName}","${safeProv}","${safeDistEn}","${safeDistKh}","${safeCommKh}","${safeCommCode}","${b.latitude || ''}","${b.longitude || ''}",${b.total_matched_places_12km || 0},${kwList.length},"${safeKw}"\r\n`;
  });

  try {
    await workbook.xlsx.writeFile(xlsxOutputPath);
    console.log(`✅ Saved official NCDD Excel file (.xlsx): ${xlsxOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${xlsxOutputPath}: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(csvOutputPath, csvContent, 'utf-8');
    console.log(`✅ Saved official NCDD UTF-8 BOM CSV file (.csv): ${csvOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${csvOutputPath}: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(dataCsvOutputPath, csvContent, 'utf-8');
    console.log(`✅ Saved official NCDD Data CSV file (.csv): ${dataCsvOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${dataCsvOutputPath}: file may be open in Excel.`);
  }

  console.log('=== OFFICIAL NCDD ENRICHMENT COMPLETE ===');
}

exportExcelAndCsv().catch(console.error);
