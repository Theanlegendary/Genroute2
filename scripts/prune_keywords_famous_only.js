/**
 * FAMOUS-ONLY KEYWORD PRUNING & DEDUPLICATION SCRIPT
 * Keeps ONLY high-priority, famous, well-known locations:
 *  1. Administrative divisions (Province, District/Khan/Krong, Commune/Sangkat, NCDD Code, Branch Code/Name)
 *  2. Famous Markets & Supermarkets (Phsar Thmei, Olympic, Kandal, Night Market, Big C, AEON, etc.)
 *  3. Major Streets, Roads & Boulevards (St 271, Veng Sreng, Russian Blvd, NR 6, etc.)
 *  4. Curated Famous Landmarks (Pagodas, Hospitals, Bridges, Universities, Airports, Expressways, Boreys)
 *
 * Performs case-insensitive deduplication and exports clean English, Khmer, and Combined columns.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const autoPick = require('../lib/auto_pick_engine');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath  = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const famousPath     = path.join(DATA_DIR, 'famous_markets.json');
const landmarksPath  = path.join(DATA_DIR, 'curated_landmarks.json');

const xlsxOutputPath = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.xlsx');
const csvOutputPath  = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.csv');

const dataCsvOutputPath  = path.join(DATA_DIR, 'pickup_branches_keywords_mapped.csv');
const ncddXlsxOutputPath = path.join(DATA_DIR, 'official_ncdd_700_branches_mapped.xlsx');
const ncddCsvOutputPath  = path.join(DATA_DIR, 'official_ncdd_700_branches_mapped.csv');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));
const famousMarkets = fs.existsSync(famousPath) ? JSON.parse(fs.readFileSync(famousPath, 'utf-8')) : [];
const landmarks     = fs.existsSync(landmarksPath) ? JSON.parse(fs.readFileSync(landmarksPath, 'utf-8')) : [];

console.log(`=== PRUNING KEYWORDS (FAMOUS & ADMIN ONLY) FOR ${branches.length} BRANCHES ===`);

// Master set of famous market & landmark names
const famousSet = new Set();
famousMarkets.forEach(m => {
  if (m.name_en) famousSet.add(m.name_en.toLowerCase().trim());
  if (m.name_kh) famousSet.add(m.name_kh.trim());
});
landmarks.forEach(l => {
  if (l.name_en) famousSet.add(l.name_en.toLowerCase().trim());
  if (l.name_kh) famousSet.add(l.name_kh.trim());
});

let totalBefore = 0;
let totalAfter  = 0;

branches.forEach(b => {
  const kwList = b.matched_keywords_12km || [];
  totalBefore += kwList.length;

  const seenMap = new Map(); // normalized lower -> original clean case

  function addKeyword(kw) {
    if (!kw || typeof kw !== 'string') return;
    const clean = kw.trim();
    if (!clean) return;
    const norm = clean.toLowerCase();
    if (!seenMap.has(norm)) {
      seenMap.set(norm, clean);
    }
  }

  // 1. Mandatory Admin & Branch Information
  if (b.store_code)   addKeyword(b.store_code);
  if (b.store_name)   addKeyword(b.store_name);
  if (b.province_kh)  addKeyword(b.province_kh);
  if (b.district_en)  addKeyword(b.district_en);
  if (b.district_kh)  addKeyword(b.district_kh);
  if (b.commune_en)   addKeyword(b.commune_en);
  if (b.commune_kh)   addKeyword(b.commune_kh);
  if (b.commune_code) addKeyword(b.commune_code);

  // 2. Filter remaining keywords for Famous Places & Major Ways
  kwList.forEach(kw => {
    if (!kw || typeof kw !== 'string') return;
    const clean = kw.trim();
    const lower = clean.toLowerCase();

    const isFamous = famousSet.has(lower) || famousSet.has(clean) ||
                     /market|phsar|ផ្សារ|supermarket|mall| night market|street|st\.|blvd|boulevard|national road| highway|ផ្លូវ|វត្ត|wat|pagoda|hospital|មន្ទីរពេទ្យ|ស្ពាន|bridge|borey|បុរី|university|សាកលវិទ្យាល័យ|airport|ពោធិ៍ចិនតុង/i.test(clean);

    if (isFamous) {
      addKeyword(clean);
    }
  });

  const finalKeywords = Array.from(seenMap.values());
  totalAfter += finalKeywords.length;

  b.matched_keywords_12km = finalKeywords;
  b.total_matched_keywords_12km = finalKeywords.length;

  // Separate English and Khmer
  const englishSet = new Set();
  const khmerSet   = new Set();

  finalKeywords.forEach(k => {
    if (/[\u1780-\u17FF]/.test(k)) {
      khmerSet.add(k);
    } else {
      englishSet.add(k);
    }
  });

  b.english_keywords_12km  = Array.from(englishSet);
  b.khmer_keywords_12km    = Array.from(khmerSet);
  b.total_english_keywords = b.english_keywords_12km.length;
  b.total_khmer_keywords   = b.khmer_keywords_12km.length;
});

console.log(`✅ Pruned Total Keywords: ${totalBefore} → ${totalAfter} (Avg per branch: ${(totalAfter/branches.length).toFixed(1)} clean terms)`);

// Save updated JSON
fs.writeFileSync(jsonInputPath, JSON.stringify(branches, null, 2), 'utf-8');
console.log(`✅ Saved data/pickup_branches_with_keywords.json`);

// Export Excel and CSV files
async function exportFiles() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Metfone GenRoute Engine';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Famous-Only Pickup Branches', {
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
    { header: 'Matched Famous Locations (<=12km)', key: 'matched_places_count', width: 25 },
    { header: 'English Keywords Count', key: 'english_keywords_count', width: 22 },
    { header: 'English Search Keywords (Pipe Separated)', key: 'english_keywords_pipe', width: 80 },
    { header: 'Khmer Keywords Count', key: 'khmer_keywords_count', width: 20 },
    { header: 'Khmer Search Keywords (Pipe Separated)', key: 'khmer_keywords_pipe', width: 80 },
    { header: 'All Combined Search Keywords (Pipe Separated)', key: 'all_keywords_pipe', width: 120 }
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
  csvContent += "No,Branch Code,Branch Store Name,Official Province (Khmer),Official District (English),Official District (Khmer),Official Commune (Khmer),NCDD Commune Code,Latitude,Longitude,Matched Famous Locations (<=12km),English Keywords Count,English Search Keywords (Pipe Separated),Khmer Keywords Count,Khmer Search Keywords (Pipe Separated),All Combined Search Keywords (Pipe Separated)\r\n";

  branches.forEach((b, index) => {
    const enList = b.english_keywords_12km || [];
    const khList = b.khmer_keywords_12km || [];
    const allList = b.matched_keywords_12km || [];

    const enPipe  = enList.join(' | ');
    const khPipe  = khList.join(' | ');
    const allPipe = allList.join(' | ');

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
      english_keywords_count: enList.length,
      english_keywords_pipe: enPipe,
      khmer_keywords_count: khList.length,
      khmer_keywords_pipe: khPipe,
      all_keywords_pipe: allPipe
    });

    const safeCode = (b.store_code || '').replace(/"/g, '""');
    const safeName = (b.store_name || '').replace(/"/g, '""');
    const safeProv = (b.province_kh || '').replace(/"/g, '""');
    const safeDistEn = (b.district_en || '').replace(/"/g, '""');
    const safeDistKh = (b.district_kh || '').replace(/"/g, '""');
    const safeCommKh = (b.commune_kh || '').replace(/"/g, '""');
    const safeCommCode = (b.commune_code || '').replace(/"/g, '""');

    const safeEnPipe  = enPipe.replace(/"/g, '""');
    const safeKhPipe  = khPipe.replace(/"/g, '""');
    const safeAllPipe = allPipe.replace(/"/g, '""');

    csvContent += `${index + 1},"${safeCode}","${safeName}","${safeProv}","${safeDistEn}","${safeDistKh}","${safeCommKh}","${safeCommCode}","${b.latitude || ''}","${b.longitude || ''}",${b.total_matched_places_12km || 0},${enList.length},"${safeEnPipe}",${khList.length},"${safeKhPipe}","${safeAllPipe}"\r\n`;
  });

  try {
    await workbook.xlsx.writeFile(xlsxOutputPath);
    console.log(`✅ Saved Excel file (.xlsx): ${xlsxOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${xlsxOutputPath}: file may be open in Excel.`);
  }

  try {
    await workbook.xlsx.writeFile(ncddXlsxOutputPath);
    console.log(`✅ Saved NCDD Excel file (.xlsx): ${ncddXlsxOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${ncddXlsxOutputPath}: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(csvOutputPath, csvContent, 'utf-8');
    console.log(`✅ Saved CSV file (.csv): ${csvOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${csvOutputPath}: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(dataCsvOutputPath, csvContent, 'utf-8');
    fs.writeFileSync(ncddCsvOutputPath, csvContent, 'utf-8');
    console.log(`✅ Saved Data CSV files (.csv)`);
  } catch (e) {
    console.warn(`⚠️ Warning writing CSV data files: file may be open in Excel.`);
  }

  console.log('=== FAMOUS-ONLY PRUNING COMPLETE ===');
}

exportFiles().catch(console.error);
