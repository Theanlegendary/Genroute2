/**
 * EXPORT CLEAN BRANCH MASTER DATA (NO KEYWORDS)
 * Creates clean Notepad .txt, .csv, .xlsx, and .json files containing ONLY:
 *  - Branch Code (store_code)
 *  - Branch Store Name (store_name)
 *  - Official Province Khmer (province_kh)
 *  - Official District English (district_en)
 *  - Official District Khmer (district_kh)
 *  - Official Commune Khmer (commune_kh)
 *  - NCDD Commune Code (commune_code)
 *  - Latitude
 *  - Longitude
 *  - Phone
 *  - Type
 *  - Status
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath = path.join(DATA_DIR, 'pickup_branches.json');
const txtOutputPath = path.join(ROOT_DIR, 'BRANCH_DATA_NO_KEYWORDS.txt');
const csvOutputPath = path.join(ROOT_DIR, 'BRANCH_DATA_NO_KEYWORDS.csv');
const xlsxOutputPath = path.join(ROOT_DIR, 'BRANCH_DATA_NO_KEYWORDS.xlsx');
const jsonOutputPath = path.join(ROOT_DIR, 'BRANCH_DATA_NO_KEYWORDS.json');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));

console.log(`=== EXPORTING CLEAN BRANCH MASTER DATA (NO KEYWORDS) FOR ${branches.length} BRANCHES ===`);

let txtContent = "================================================================================\r\n";
txtContent += "METFONE PICKUP BRANCH MASTER DATA (697 BRANCHES - NO KEYWORDS)\r\n";
txtContent += "================================================================================\r\n\r\n";

const cleanData = [];

branches.forEach((b, idx) => {
  txtContent += `[BRANCH #${idx + 1}]\r\n`;
  txtContent += `Branch Code   : ${b.store_code || ''}\r\n`;
  txtContent += `Store Name    : ${b.store_name || ''}\r\n`;
  txtContent += `Province (KH) : ${b.province_kh || ''}\r\n`;
  txtContent += `District (EN) : ${b.district_en || ''}\r\n`;
  txtContent += `District (KH) : ${b.district_kh || ''}\r\n`;
  txtContent += `Commune (KH)  : ${b.commune_kh || ''}\r\n`;
  txtContent += `NCDD Code     : ${b.commune_code || ''}\r\n`;
  txtContent += `Latitude      : ${b.latitude || ''}\r\n`;
  txtContent += `Longitude     : ${b.longitude || ''}\r\n`;
  txtContent += `Phone         : ${b.phone || ''}\r\n`;
  txtContent += `Type          : ${b.type || ''}\r\n`;
  txtContent += `Status        : ${b.status || ''}\r\n`;
  txtContent += `--------------------------------------------------------------------------------\r\n\r\n`;

  cleanData.push({
    no: idx + 1,
    store_code: b.store_code || '',
    store_name: b.store_name || '',
    province_kh: b.province_kh || '',
    district_en: b.district_en || '',
    district_kh: b.district_kh || '',
    commune_kh: b.commune_kh || '',
    commune_code: b.commune_code || '',
    latitude: b.latitude || '',
    longitude: b.longitude || '',
    phone: b.phone || '',
    type: b.type || '',
    status: b.status || ''
  });
});

// 1. Save Text File (.txt)
fs.writeFileSync(txtOutputPath, txtContent, 'utf-8');
console.log(`✅ Saved Notepad Text File (.txt): ${txtOutputPath}`);

// 2. Save JSON File (.json)
fs.writeFileSync(jsonOutputPath, JSON.stringify(cleanData, null, 2), 'utf-8');
console.log(`✅ Saved JSON File (.json): ${jsonOutputPath}`);

// 3. Save CSV File (.csv)
let csvContent = "\uFEFF"; // UTF-8 BOM
csvContent += "No,Branch Code,Branch Store Name,Province (Khmer),District (English),District (Khmer),Commune (Khmer),NCDD Commune Code,Latitude,Longitude,Phone,Type,Status\r\n";

cleanData.forEach(b => {
  const safeCode = b.store_code.replace(/"/g, '""');
  const safeName = b.store_name.replace(/"/g, '""');
  const safeProv = b.province_kh.replace(/"/g, '""');
  const safeDistEn = b.district_en.replace(/"/g, '""');
  const safeDistKh = b.district_kh.replace(/"/g, '""');
  const safeCommKh = b.commune_kh.replace(/"/g, '""');
  const safeCodeNcdd = b.commune_code.replace(/"/g, '""');
  const safePhone = b.phone.replace(/"/g, '""');
  const safeType = b.type.replace(/"/g, '""');
  const safeStatus = b.status.replace(/"/g, '""');

  csvContent += `${b.no},"${safeCode}","${safeName}","${safeProv}","${safeDistEn}","${safeDistKh}","${safeCommKh}","${safeCodeNcdd}","${b.latitude}","${b.longitude}","${safePhone}","${safeType}","${safeStatus}"\r\n`;
});

fs.writeFileSync(csvOutputPath, csvContent, 'utf-8');
console.log(`✅ Saved CSV File (.csv): ${csvOutputPath}`);

// 4. Save Excel File (.xlsx)
async function exportExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Metfone GenRoute Engine';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Branch Master (No Keywords)', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Branch Code', key: 'store_code', width: 15 },
    { header: 'Branch Store Name', key: 'store_name', width: 25 },
    { header: 'Province (Khmer)', key: 'province_kh', width: 25 },
    { header: 'District (English)', key: 'district_en', width: 24 },
    { header: 'District (Khmer)', key: 'district_kh', width: 24 },
    { header: 'Commune (Khmer)', key: 'commune_kh', width: 24 },
    { header: 'NCDD Commune Code', key: 'commune_code', width: 20 },
    { header: 'Latitude', key: 'latitude', width: 14 },
    { header: 'Longitude', key: 'longitude', width: 14 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Type', key: 'type', width: 30 },
    { header: 'Status', key: 'status', width: 14 }
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

  cleanData.forEach(b => {
    worksheet.addRow(b);
  });

  try {
    await workbook.xlsx.writeFile(xlsxOutputPath);
    console.log(`✅ Saved Excel File (.xlsx): ${xlsxOutputPath}`);
  } catch (e) {
    console.warn(`⚠️ Warning writing Excel file: file may be open in Excel.`);
  }

  console.log('=== CLEAN BRANCH MASTER EXPORT COMPLETE ===');
}

exportExcel().catch(console.error);
