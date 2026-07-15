const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '..', 'ncdd_admin_database_25provinces__14.10.2024.xlsx');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'ncdd_hierarchy.json');

const PROVINCE_KHMER_NAMES = {
  "Phnom Penh": "ភ្នំពេញ",
  "Kandal": "កណ្តាល",
  "Kampong Cham": "កំពង់ចាម",
  "Kampong Chhnang": "កំពង់ឆ្នាំង",
  "Kampong Speu": "កំពង់ស្ពឺ",
  "Kampong Thom": "កំពង់ធំ",
  "Kampot": "កំពត",
  "Koh Kong": "កោះកុង",
  "Kratie": "ក្រចេះ",
  "Mondul Kiri": "មណ្ឌលគិរី",
  "Preah Vihear": "ព្រះវិហារ",
  "Prey Veng": "ព្រៃវែង",
  "Pursat": "ពោធិ៍សាត់",
  "Ratanak Kiri": "រតនគិរី",
  "Siemreap": "សៀមរាប",
  "Siem Reap": "សៀមរាប",
  "Preah Sihanouk": "ព្រះសីហនុ",
  "Stung Treng": "ស្ទឹងត្រែង",
  "Svay Rieng": "ស្វាយរៀង",
  "Takeo": "តាកែវ",
  "Oddar Meanchey": "ឧត្តរមានជ័យ",
  "Kep": "កែប",
  "Pailin": "ប៉ៃលិន",
  "Tboung Khmum": "ត្បូងឃ្មុំ",
  "Banteay Meanchey": "បន្ទាយមានជ័យ"
};

function parse() {
  console.log('Reading NCDD Excel file:', EXCEL_FILE);
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  const hierarchy = [];
  
  workbook.SheetNames.forEach(sheetName => {
    // Extract province index and name, e.g. "15. Pursat" -> index 15, name "Pursat"
    const match = sheetName.match(/^(\d+)\.\s*(.+)$/);
    if (!match) {
      console.warn(`⚠️ Skipping sheet with unexpected name format: "${sheetName}"`);
      return;
    }
    
    const provIndexStr = match[1];
    const provNameEn = match[2].trim();
    const provNameKh = PROVINCE_KHMER_NAMES[provNameEn] || provNameEn;
    const provCode = provIndexStr.padStart(2, '0'); // e.g. "5" -> "05", "15" -> "15"
    
    console.log(`Processing Province: ${provNameEn} (Code: ${provCode})`);
    
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    const provinceNode = {
      code: provCode,
      name_en: provNameEn,
      name_kh: provNameKh,
      districts: []
    };
    
    // Maps to keep track of districts and communes by their code for quick nesting
    const districtMap = new Map();
    const communeMap = new Map();
    
    rows.forEach((row, rowIndex) => {
      // Row structure: [Type, Code, Name (Khmer), Name (Latin), Reference, Official Note, Note (by Checker)]
      if (row.length < 4) return;
      
      const type = String(row[0] || '').trim();
      let code = String(row[1] || '').trim();
      const nameKh = String(row[2] || '').trim();
      const nameEn = String(row[3] || '').trim();
      
      // Basic validation: code must be numeric
      if (!/^\d+$/.test(code)) return;

      // Pad codes to standard NCDD length to fix dropped leading zeros in Excel
      if (type === 'ស្រុក' || type === 'ក្រុង' || type === 'ខណ្ឌ') {
        code = code.padStart(4, '0');
      } else if (type === 'ឃុំ' || type === 'សង្កាត់') {
        code = code.padStart(6, '0');
      } else if (type === 'ភូមិ') {
        code = code.padStart(8, '0');
      }
      
      // Parse District / Municipality / Khan
      if (type === 'ស្រុក' || type === 'ក្រុង' || type === 'ខណ្ឌ') {
        const districtNode = {
          code: code,
          type: type,
          name_en: nameEn,
          name_kh: nameKh,
          communes: []
        };
        provinceNode.districts.push(districtNode);
        districtMap.set(code, districtNode);
      }
      
      // Parse Commune / Sangkat
      else if (type === 'ឃុំ' || type === 'សង្កាត់') {
        const distCode = code.substring(0, 4);
        const districtNode = districtMap.get(distCode);
        
        const communeNode = {
          code: code,
          type: type,
          name_en: nameEn,
          name_kh: nameKh,
          villages: []
        };
        
        if (districtNode) {
          districtNode.communes.push(communeNode);
          communeMap.set(code, communeNode);
        } else {
          // Fallback if district row was missing or out of order
          console.warn(`⚠️ Warning: Commune ${nameEn} (${code}) has no matching district ${distCode} in sheet.`);
          // Create dummy district
          const dummyDist = {
            code: distCode,
            type: 'ស្រុក',
            name_en: `District ${distCode}`,
            name_kh: `ស្រុក ${distCode}`,
            communes: [communeNode]
          };
          provinceNode.districts.push(dummyDist);
          districtMap.set(distCode, dummyDist);
          communeMap.set(code, communeNode);
        }
      }
      
      // Parse Village (ភូមិ)
      else if (type === 'ភូមិ') {
        const commCode = code.substring(0, 6);
        const communeNode = communeMap.get(commCode);
        
        const villageNode = {
          code: code,
          name_en: nameEn,
          name_kh: nameKh
        };
        
        if (communeNode) {
          communeNode.villages.push(villageNode);
        } else {
          // Fallback if commune row was missing or out of order
          const distCode = code.substring(0, 4);
          let districtNode = districtMap.get(distCode);
          if (!districtNode) {
            districtNode = {
              code: distCode,
              type: 'ស្រុក',
              name_en: `District ${distCode}`,
              name_kh: `ស្រុក ${distCode}`,
              communes: []
            };
            provinceNode.districts.push(districtNode);
            districtMap.set(distCode, districtNode);
          }
          
          const dummyComm = {
            code: commCode,
            type: 'ឃុំ',
            name_en: `Commune ${commCode}`,
            name_kh: `ឃុំ ${commCode}`,
            villages: [villageNode]
          };
          districtNode.communes.push(dummyComm);
          communeMap.set(commCode, dummyComm);
        }
      }
    });
    
    hierarchy.push(provinceNode);
  });
  
  // Sort provinces by code
  hierarchy.sort((a, b) => parseInt(a.code) - parseInt(b.code));
  
  console.log(`Writing parsed NCDD hierarchy to: ${OUTPUT_FILE}`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(hierarchy, null, 2), 'utf-8');
  
  // Print some statistics
  let distCount = 0;
  let commCount = 0;
  let villCount = 0;
  
  hierarchy.forEach(p => {
    distCount += p.districts.length;
    p.districts.forEach(d => {
      commCount += d.communes.length;
      d.communes.forEach(c => {
        villCount += c.villages.length;
      });
    });
  });
  
  console.log('✅ Done parsing!');
  console.log(`- Provinces: ${hierarchy.length}`);
  console.log(`- Districts/Municipalities/Khans: ${distCount}`);
  console.log(`- Communes/Sangkats: ${commCount}`);
  console.log(`- Villages: ${villCount}`);
}

parse();
