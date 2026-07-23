/**
 * FIX ALL KHMER UNICODE KEYWORDS & RE-GENERATE ALL DATA FILES
 * 1. Normalizes decomposed vowels (េី -> ើ, េា -> ោ, មអាន -> មាន)
 * 2. Removes zero-width characters (\u200B, \u200C, \uFEFF)
 * 3. Deduplicates and cleans extra whitespace
 * 4. Re-writes all JSON, CSV, and XLSX export files with UTF-8 BOM
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const autoPick = require('../lib/auto_pick_engine');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonPath = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const xlsxPath = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.xlsx');
const csvPath  = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.csv');
const dataCsvPath = path.join(DATA_DIR, 'pickup_branches_keywords_mapped.csv');

const branches = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

console.log(`=== NORMALIZING KHMER KEYWORDS FOR ${branches.length} BRANCHES ===`);

/**
 * Normalizes Khmer spelling and fixes decomposed Unicode characters
 */
function cleanKhmerString(str) {
  if (!str) return '';
  let s = str.normalize('NFC').trim();
  // Strip zero-width & invisible characters
  s = s.replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');
  // Decomposed vowels -> composed
  s = s.replace(/\u17C1\u17B8/g, '\u17BE'); // េី -> ើ
  s = s.replace(/\u17C1\u17B6/g, '\u17C4'); // េា -> ោ
  // Common decomposed spelling fixes (e.g. មអាន -> មាន)
  s = s.replace(/មអាន/g, 'មាន');
  s = s.replace(/តេបាក/g, 'ត្បែក');
  // Clean double spaces
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

let totalFixed = 0;

branches.forEach(b => {
  if (b.province_kh) b.province_kh = cleanKhmerString(b.province_kh);
  if (b.district_kh) b.district_kh = cleanKhmerString(b.district_kh);
  if (b.commune_kh)  b.commune_kh  = cleanKhmerString(b.commune_kh);

  if (b.matched_keywords_12km && Array.isArray(b.matched_keywords_12km)) {
    const cleanedSet = new Set();
    b.matched_keywords_12km.forEach(kw => {
      const cleaned = cleanKhmerString(kw);
      if (cleaned) {
        if (cleaned !== kw) totalFixed++;
        cleanedSet.add(cleaned);
      }
    });
    b.matched_keywords_12km = Array.from(cleanedSet);
    b.total_matched_keywords_12km = b.matched_keywords_12km.length;
  }

  if (b.matched_places_12km && Array.isArray(b.matched_places_12km)) {
    b.matched_places_12km.forEach(p => {
      if (p.name_kh) p.name_kh = cleanKhmerString(p.name_kh);
      if (p.province_kh) p.province_kh = cleanKhmerString(p.province_kh);
      if (p.district_kh) p.district_kh = cleanKhmerString(p.district_kh);
    });
  }
});

console.log(`✅ Applied Khmer Unicode normalization fixes: ${totalFixed} keywords cleaned`);

// 1. Update JSON database
fs.writeFileSync(jsonPath, JSON.stringify(branches, null, 2), 'utf-8');
console.log(`✅ Updated JSON file: ${jsonPath}`);

// 2. Generate Native Excel (.xlsx) & UTF-8 BOM CSV (.csv)
async function exportFiles() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Metfone GenRoute Engine';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('697 Pickup Branches Keywords', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Branch Code', key: 'store_code', width: 15 },
    { header: 'Branch Store Name', key: 'store_name', width: 25 },
    { header: 'Province (Khmer)', key: 'province_kh', width: 22 },
    { header: 'District (English)', key: 'district_en', width: 22 },
    { header: 'District (Khmer)', key: 'district_kh', width: 22 },
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
  csvContent += "No,Branch Code,Branch Store Name,Province (Khmer),District (English),District (Khmer),Latitude,Longitude,Matched Locations (<=12km),Total Keywords,All Search Keywords (Pipe Separated)\r\n";

  branches.forEach((b, index) => {
    const kwList = b.matched_keywords_12km || [];
    const pipeKeywords = kwList.join(' | ');

    worksheet.addRow({
      no: index + 1,
      store_code: b.store_code || '',
      store_name: b.store_name || '',
      province_kh: b.province_kh || '',
      district_en: b.district_en || '',
      district_kh: b.district_kh || '',
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
    const safeKw = pipeKeywords.replace(/"/g, '""');

    csvContent += `${index + 1},"${safeCode}","${safeName}","${safeProv}","${safeDistEn}","${safeDistKh}","${b.latitude || ''}","${b.longitude || ''}",${b.total_matched_places_12km || 0},${kwList.length},"${safeKw}"\r\n`;
  });

  await workbook.xlsx.writeFile(xlsxPath);
  console.log(`✅ Updated Native Excel file (.xlsx): ${xlsxPath}`);

  try {
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`✅ Updated UTF-8 BOM CSV file (.csv): ${csvPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${csvPath}: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(dataCsvPath, csvContent, 'utf-8');
    console.log(`✅ Updated Data CSV file (.csv): ${dataCsvPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${dataCsvPath}: file may be open in Excel.`);
  }

  console.log('=== KHMER NORMALIZATION COMPLETE ===');
}

exportFiles().catch(console.error);
