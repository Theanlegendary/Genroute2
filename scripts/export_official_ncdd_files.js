/**
 * EXPORT OFFICIAL NCDD 700 BRANCHES MAPPED FILES
 * Creates:
 * - data/official_ncdd_700_branches_mapped.xlsx
 * - data/official_ncdd_700_branches_mapped.csv
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const jsonInputPath = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');

const xlsxOutputPath = path.join(DATA_DIR, 'official_ncdd_700_branches_mapped.xlsx');
const csvOutputPath  = path.join(DATA_DIR, 'official_ncdd_700_branches_mapped.csv');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));

console.log(`=== CREATING OFFICIAL NCDD DATA EXPORTS FOR ${branches.length} BRANCHES ===`);

async function generateExports() {
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

  await workbook.xlsx.writeFile(xlsxOutputPath);
  console.log(`✅ Saved official NCDD Excel file (.xlsx): ${xlsxOutputPath}`);

  fs.writeFileSync(csvOutputPath, csvContent, 'utf-8');
  console.log(`✅ Saved official NCDD UTF-8 BOM CSV file (.csv): ${csvOutputPath}`);
}

generateExports().catch(console.error);
