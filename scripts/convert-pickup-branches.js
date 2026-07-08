const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', '..', 'PickupBranches.xlsx');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'pickup_branches.json');

function convert() {
  console.log('Reading Excel file...');
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('❌ Input file not found:', INPUT_FILE);
    process.exit(1);
  }

  const workbook = xlsx.readFile(INPUT_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  console.log(`Parsed ${data.length} rows. Processing...`);

  const processed = data.map((row, index) => {
    // The Excel columns might vary slightly. We try to match based on common names.
    // Required fields based on design: Province (KH), District (EN), District KH, Delivery Store, Latitude, Longitude
    const provinceKh = row['Province *'] || '';
    const districtEn = row['District *'] || '';
    const districtKh = row['District KH'] || '';
    const deliveryStore = row['Delivery Store *'] || '';
    const lat = parseFloat(row['Latitude']);
    const lng = parseFloat(row['Longitude']);

    // Split "Delivery Store" into code and name (e.g., "BANA001 - Chamnaom")
    let storeCode = '';
    let storeName = '';
    if (deliveryStore) {
      const parts = deliveryStore.split(' - ');
      storeCode = parts[0] ? parts[0].trim() : '';
      storeName = parts[1] ? parts[1].trim() : '';
    }

    return {
      store_code: storeCode,
      store_name: storeName,
      province_kh: provinceKh,
      district_en: districtEn,
      district_kh: districtKh,
      latitude: lat,
      longitude: lng,
      raw_delivery_store: deliveryStore
    };
  });

  // Filter out records with invalid coordinates
  const valid = processed.filter(item => !isNaN(item.latitude) && !isNaN(item.longitude));
  console.log(`✅ Successfully processed ${valid.length} valid records out of ${processed.length} total rows.`);

  // Ensure output directory exists
  const dataDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(valid, null, 2));
  console.log(`💾 Saved to ${OUTPUT_FILE}`);
}

convert();
