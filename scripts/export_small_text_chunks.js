/**
 * EXPORT SMALL CHUNKS FOR DIRECT COPY-PASTING INTO AI PROMPTS
 * Creates:
 *  - BRANCH_SAMPLE_1_TO_50.txt
 *  - BRANCH_SAMPLE_51_TO_100.txt
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));

function buildCompactTxt(branchList, title) {
  let txt = `=== ${title} ===\r\n\r\n`;
  branchList.forEach(b => {
    const enKw = b.english_keywords_12km || [];
    txt += `Branch: ${b.store_code} | Name: ${b.store_name} | District: ${b.district_en} | NCDD: ${b.commune_code} | GPS: ${b.latitude},${b.longitude}\r\n`;
    txt += `Keywords: ${enKw.join(' | ')}\r\n\r\n`;
  });
  return txt;
}

const sample1 = branches.slice(0, 50);
const sample2 = branches.slice(50, 100);

fs.writeFileSync(path.join(ROOT_DIR, 'BRANCH_SAMPLE_1_TO_50.txt'), buildCompactTxt(sample1, 'BRANCHES 1 TO 50'), 'utf-8');
fs.writeFileSync(path.join(ROOT_DIR, 'BRANCH_SAMPLE_51_TO_100.txt'), buildCompactTxt(sample2, 'BRANCHES 51 TO 100'), 'utf-8');

console.log('✅ Created BRANCH_SAMPLE_1_TO_50.txt');
console.log('✅ Created BRANCH_SAMPLE_51_TO_100.txt');
