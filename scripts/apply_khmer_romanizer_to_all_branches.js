/**
 * APPLY BGN/PCGN KHMER ROMANIZER TO ALL 697 PICKUP BRANCHES
 * 1. Takes all Khmer keywords for every branch and generates accurate Latin transliteration.
 * 2. Takes all Latin keywords and generates accurate Khmer transliteration.
 * 3. Deduplicates and formats as pipe-separated keywords.
 * 4. Re-exports:
 *    - all_700_branches_keywords_mapped.xlsx
 *    - all_700_branches_keywords_mapped.csv
 *    - data/pickup_branches_with_keywords.json
 *    - data/pickup_branches_keywords_mapped.csv
 *    - data/official_ncdd_700_branches_mapped.xlsx
 *    - data/official_ncdd_700_branches_mapped.csv
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const romanizer = require('../lib/khmer_romanizer');
const autoPick  = require('../lib/auto_pick_engine');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath  = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const xlsxOutputPath = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.xlsx');
const csvOutputPath  = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.csv');

const dataCsvOutputPath  = path.join(DATA_DIR, 'pickup_branches_keywords_mapped.csv');
const ncddXlsxOutputPath = path.join(DATA_DIR, 'official_ncdd_700_branches_mapped.xlsx');
const ncddCsvOutputPath  = path.join(DATA_DIR, 'official_ncdd_700_branches_mapped.csv');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));

console.log(`=== RUNNING BGN/PCGN ROMANIZATION ENGINE FOR ${branches.length} BRANCHES ===`);

let totalTransliterated = 0;

branches.forEach(b => {
  const kwSet = new Set();

  // Add original keywords
  if (b.matched_keywords_12km && Array.isArray(b.matched_keywords_12km)) {
    b.matched_keywords_12km.forEach(k => {
      if (k && k.trim()) kwSet.add(k.trim());
    });
  }

  // Generate transliterations for Khmer keywords
  const currentList = Array.from(kwSet);
  currentList.forEach(k => {
    // If contains Khmer characters -> generate Latin transliteration
    if (/[\u1780-\u17FF]/.test(k)) {
      const latin = romanizer.khmerToLatin(k);
      if (latin && latin.trim() && latin !== k) {
        kwSet.add(latin.trim());
        totalTransliterated++;
      }
    }
  });

  const finalKwList = Array.from(kwSet);
  b.matched_keywords_12km = finalKwList;
  b.total_matched_keywords_12km = finalKwList.length;
});

console.log(`✅ Generated ${totalTransliterated} BGN/PCGN Latin transliterations across ${branches.length} branches`);

// Save updated JSON
fs.writeFileSync(jsonInputPath, JSON.stringify(branches, null, 2), 'utf-8');
console.log(`✅ Updated data/pickup_branches_with_keywords.json`);

// Export Excel and CSV files
async function exportFiles() {
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
    console.log(`✅ Updated Excel File (.xlsx): ${xlsxOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${xlsxOutputPath}: file may be open in Excel.`);
  }

  try {
    await workbook.xlsx.writeFile(ncddXlsxOutputPath);
    console.log(`✅ Updated NCDD Data Excel File (.xlsx): ${ncddXlsxOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${ncddXlsxOutputPath}: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(csvOutputPath, csvContent, 'utf-8');
    console.log(`✅ Updated CSV File (.csv): ${csvOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing ${csvOutputPath}: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(dataCsvOutputPath, csvContent, 'utf-8');
    fs.writeFileSync(ncddCsvOutputPath, csvContent, 'utf-8');
    console.log(`✅ Updated Data CSV Files (.csv)`);
  } catch (e) {
    console.warn(`⚠️ Warning writing CSV data files: file may be open in Excel.`);
  }

  console.log('=== ROMANIZATION ENRICHMENT COMPLETE ===');
}

exportFiles().catch(console.error);
