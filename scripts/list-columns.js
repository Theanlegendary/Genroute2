const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', '..', 'PickupBranches.xlsx');

function listColumns() {
  console.log('Reading Excel file headers...');
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('❌ Input file not found:', INPUT_FILE);
    process.exit(1);
  }

  const workbook = xlsx.readFile(INPUT_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  if (data.length > 0) {
    console.log('Columns found in the first row:', Object.keys(data[0]));
  } else {
    console.log('No data found in the Excel file.');
  }
}

listColumns();
