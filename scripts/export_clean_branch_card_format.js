/**
 * EXPORT 697 PICKUP BRANCHES IN CARD FORMAT (WITHOUT NCDD BRACKETS)
 * Format:
 *  [BRANCH BANA001]
 *  Code      : BANA001
 *  Name      : Chamnaom
 *  Province  : បន្ទាយមានជ័យ
 *  District  : Mongkol Borei (មង្គលបូរី)
 *  Commune   : ចំណោម
 *  Location  : 13.437565, 102.934632
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath = path.join(DATA_DIR, 'pickup_branches.json');
const txtOutputPath = path.join(ROOT_DIR, 'CLEAN_BRANCHES_FORMATTED.txt');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));

console.log(`=== REMOVING NCDD BRACKETS FOR ALL ${branches.length} BRANCHES ===`);

let txtContent = "";

branches.forEach(b => {
  const distStr = `${b.district_en || ''} (${b.district_kh || ''})`;
  const commStr = `${b.commune_kh || ''}`;

  txtContent += `[BRANCH ${b.store_code || ''}]\r\n`;
  txtContent += `Code      : ${b.store_code || ''}\r\n`;
  txtContent += `Name      : ${b.store_name || ''}\r\n`;
  txtContent += `Province  : ${b.province_kh || ''}\r\n`;
  txtContent += `District  : ${distStr}\r\n`;
  txtContent += `Commune   : ${commStr}\r\n`;
  txtContent += `Location  : ${b.latitude || ''}, ${b.longitude || ''}\r\n`;
  txtContent += `\r\n`;
});

fs.writeFileSync(txtOutputPath, txtContent, 'utf-8');
console.log(`✅ Saved CLEAN_BRANCHES_FORMATTED.txt: ${txtOutputPath}`);

console.log('=== REMOVAL COMPLETE ===');
