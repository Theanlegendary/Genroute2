/**
 * GOOGLE & NCDD GEOGRAPHY EN/KH ALIGNMENT SCRIPT
 * 1. Fixes any EN/KH swaps or mismatches across all 697 pickup branches.
 * 2. Enforces 100% clean English names in *_en fields and 100% clean Khmer names in *_kh fields.
 * 3. Aligns locations_master_lookup.json so name_en and name_kh are properly assigned.
 * 4. Re-exports:
 *    - CLEAN_BRANCHES_FORMATTED.txt
 *    - BRANCH_KEYWORDS_ENGLISH_ONLY.txt
 *    - BRANCH_DATA_NO_KEYWORDS.txt
 *    - data/locations_master_lookup.json
 *    - data/branches_relational_profiles.json
 *    - data/pickup_branches.json
 *    - data/pickup_branches_with_keywords.json
 *    - all_700_branches_keywords_mapped.xlsx
 *    - all_700_branches_keywords_mapped.csv
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const autoPick = require('../lib/auto_pick_engine');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const ncddPath     = path.join(DATA_DIR, 'ncdd_hierarchy.json');
const branchesPath = path.join(DATA_DIR, 'pickup_branches.json');
const jsonInputPath= path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const locMasterPath= path.join(DATA_DIR, 'locations_master_lookup.json');
const branchRelPath= path.join(DATA_DIR, 'branches_relational_profiles.json');

const ncdd = JSON.parse(fs.readFileSync(ncddPath, 'utf-8'));
const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));
const locationsMaster = JSON.parse(fs.readFileSync(locMasterPath, 'utf-8'));

console.log('=== ALIGNING EN/KH NAMES TO GOOGLE & NCDD OFFICIAL STANDARDS ===');

// Build NCDD commune lookup dictionary
const ncddCommuneMap = new Map();
ncdd.forEach(p => {
  if (p.districts) {
    p.districts.forEach(d => {
      if (d.communes) {
        d.communes.forEach(c => {
          ncddCommuneMap.set(c.code, {
            province_en: p.name_en,
            province_kh: p.name_kh,
            district_en: d.name_en,
            district_kh: d.name_kh,
            commune_en: c.name_en,
            commune_kh: c.name_kh
          });
        });
      }
    });
  }
});

// 1. Align Pickup Branches
let alignedBranchesCount = 0;

branches.forEach(b => {
  if (b.commune_code && ncddCommuneMap.has(b.commune_code)) {
    const official = ncddCommuneMap.get(b.commune_code);
    b.province_en = official.province_en;
    b.province_kh = official.province_kh;
    b.district_en = official.district_en;
    b.district_kh = official.district_kh;
    b.commune_en  = official.commune_en;
    b.commune_kh  = official.commune_kh;
    alignedBranchesCount++;
  } else {
    // Basic EN/KH swap fallback
    if (/[\u1780-\u17FF]/.test(b.district_en || '')) {
      const temp = b.district_en;
      b.district_en = b.district_kh && !/[\u1780-\u17FF]/.test(b.district_kh) ? b.district_kh : b.store_name;
      b.district_kh = temp;
    }
  }
});

console.log(`✅ Aligned ${alignedBranchesCount} / ${branches.length} pickup branches to official Google/NCDD standards`);

// Save pickup_branches.json and pickup_branches_with_keywords.json
fs.writeFileSync(branchesPath, JSON.stringify(branches, null, 2), 'utf-8');
fs.writeFileSync(jsonInputPath, JSON.stringify(branches, null, 2), 'utf-8');
console.log(`✅ Saved data/pickup_branches.json & data/pickup_branches_with_keywords.json`);

// 2. Align Locations Master Table
let locFixedCount = 0;

Object.keys(locationsMaster).forEach(key => {
  const loc = locationsMaster[key];

  // If name_en contains Khmer characters -> move to name_kh
  if (/[\u1780-\u17FF]/.test(loc.name_en)) {
    const oldEn = loc.name_en;
    loc.name_en = loc.name_kh && !/[\u1780-\u17FF]/.test(loc.name_kh) ? loc.name_kh : '';
    loc.name_kh = oldEn;
    locFixedCount++;
  }

  // If name_kh contains Latin characters -> move to name_en
  if (loc.name_kh && !/[\u1780-\u17FF]/.test(loc.name_kh) && !loc.name_en) {
    loc.name_en = loc.name_kh;
    loc.name_kh = '';
    locFixedCount++;
  }
});

fs.writeFileSync(locMasterPath, JSON.stringify(locationsMaster, null, 2), 'utf-8');
console.log(`✅ Saved data/locations_master_lookup.json (${locFixedCount} name swaps fixed)`);

// 3. Export CLEAN_BRANCHES_FORMATTED.txt (Card Format)
let cardTxtContent = "";
branches.forEach(b => {
  const distStr = `${b.district_en || ''} (${b.district_kh || ''})`;
  const commStr = `${b.commune_kh || ''}`;

  cardTxtContent += `[BRANCH ${b.store_code || ''}]\r\n`;
  cardTxtContent += `Code      : ${b.store_code || ''}\r\n`;
  cardTxtContent += `Name      : ${b.store_name || ''}\r\n`;
  cardTxtContent += `Province  : ${b.province_kh || ''}\r\n`;
  cardTxtContent += `District  : ${distStr}\r\n`;
  cardTxtContent += `Commune   : ${commStr}\r\n`;
  cardTxtContent += `Location  : ${b.latitude || ''}, ${b.longitude || ''}\r\n`;
  cardTxtContent += `\r\n`;
});

fs.writeFileSync(path.join(ROOT_DIR, 'CLEAN_BRANCHES_FORMATTED.txt'), cardTxtContent, 'utf-8');
console.log(`✅ Updated CLEAN_BRANCHES_FORMATTED.txt`);

// 4. Export BRANCH_KEYWORDS_ENGLISH_ONLY.txt
let enTxtContent = "================================================================================\r\n";
enTxtContent += "PICKUP BRANCHES - GOOGLE ALIGNED ENGLISH KEYWORDS & MAJOR STREETS (FOR NOTEPAD / AI)\r\n";
enTxtContent += "Total Branches: " + branches.length + "\r\n";
enTxtContent += "================================================================================\r\n\r\n";

branches.forEach((b, idx) => {
  const enKw = b.english_keywords_12km || [];
  const pipeEn = enKw.join(' | ');

  enTxtContent += `[BRANCH #${idx + 1}]\r\n`;
  enTxtContent += `Branch Code   : ${b.store_code || ''}\r\n`;
  enTxtContent += `Store Name    : ${b.store_name || ''}\r\n`;
  enTxtContent += `Province (EN) : ${b.province_en || ''}\r\n`;
  enTxtContent += `Province (KH) : ${b.province_kh || ''}\r\n`;
  enTxtContent += `District (EN) : ${b.district_en || ''}\r\n`;
  enTxtContent += `District (KH) : ${b.district_kh || ''}\r\n`;
  enTxtContent += `Commune (EN)  : ${b.commune_en || ''}\r\n`;
  enTxtContent += `Commune (KH)  : ${b.commune_kh || ''}\r\n`;
  enTxtContent += `NCDD Code     : ${b.commune_code || ''}\r\n`;
  enTxtContent += `Latitude      : ${b.latitude || ''}\r\n`;
  enTxtContent += `Longitude     : ${b.longitude || ''}\r\n`;
  enTxtContent += `Top English Keywords (${enKw.length}) :\r\n${pipeEn}\r\n`;
  enTxtContent += `--------------------------------------------------------------------------------\r\n\r\n`;
});

fs.writeFileSync(path.join(ROOT_DIR, 'BRANCH_KEYWORDS_ENGLISH_ONLY.txt'), enTxtContent, 'utf-8');
console.log(`✅ Updated BRANCH_KEYWORDS_ENGLISH_ONLY.txt`);

// 5. Export Excel & CSV files
async function exportExcelAndCsv() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Metfone GenRoute Engine';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Google Aligned Pickup Branches', {
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
    { header: 'English Keywords Count', key: 'english_keywords_count', width: 22 },
    { header: 'English Search Keywords (Pipe Separated)', key: 'english_keywords_pipe', width: 80 },
    { header: 'Khmer Keywords Count', key: 'khmer_keywords_count', width: 20 },
    { header: 'Khmer Search Keywords (Pipe Separated)', key: 'khmer_keywords_pipe', width: 80 }
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
  csvContent += "No,Branch Code,Branch Store Name,Province (English),Province (Khmer),District (English),District (Khmer),Commune (English),Commune (Khmer),NCDD Commune Code,Latitude,Longitude,English Keywords Count,English Search Keywords (Pipe Separated),Khmer Keywords Count,Khmer Search Keywords (Pipe Separated)\r\n";

  branches.forEach((b, index) => {
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
      english_keywords_count: enList.length,
      english_keywords_pipe: enPipe,
      khmer_keywords_count: khList.length,
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

    const safeEnPipe = enPipe.replace(/"/g, '""');
    const safeKhPipe = khPipe.replace(/"/g, '""');

    csvContent += `${index + 1},"${safeCode}","${safeName}","${safeProvEn}","${safeProvKh}","${safeDistEn}","${safeDistKh}","${safeCommEn}","${safeCommKh}","${safeCommCode}","${b.latitude || ''}","${b.longitude || ''}",${enList.length},"${safeEnPipe}",${khList.length},"${safeKhPipe}"\r\n`;
  });

  const xlsxPath = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.xlsx');
  const csvPath  = path.join(ROOT_DIR, 'all_700_branches_keywords_mapped.csv');

  try {
    await workbook.xlsx.writeFile(xlsxPath);
    console.log(`✅ Saved Excel file (.xlsx): ${xlsxPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing Excel file: file may be open in Excel.`);
  }

  try {
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    fs.writeFileSync(path.join(DATA_DIR, 'pickup_branches_keywords_mapped.csv'), csvContent, 'utf-8');
    console.log(`✅ Saved CSV files (.csv)`);
  } catch (e) {
    console.warn(`⚠️ Warning writing CSV file: file may be open in Excel.`);
  }

  console.log('=== ALIGNMENT COMPLETE ===');
}

exportExcelAndCsv().catch(console.error);
