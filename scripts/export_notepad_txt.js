/**
 * EXPORT PLAIN TEXT FILE FOR NOTEPAD / AI COPY-PASTING
 * Creates:
 *  1. BRANCH_KEYWORDS_ENGLISH_ONLY.txt (Clean text file with Branch info + English Keywords, pipe separated)
 *  2. BRANCH_DATA_FOR_AI.json (Clean JSON file for AI prompts)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const jsonInputPath = path.join(DATA_DIR, 'pickup_branches_with_keywords.json');
const txtOutputPath = path.join(ROOT_DIR, 'BRANCH_KEYWORDS_ENGLISH_ONLY.txt');
const jsonOutputPath = path.join(ROOT_DIR, 'BRANCH_DATA_FOR_AI.json');

const branches = JSON.parse(fs.readFileSync(jsonInputPath, 'utf-8'));

console.log(`=== CREATING NOTEPAD TXT FILE FOR ${branches.length} BRANCHES ===`);

let txtContent = "================================================================================\r\n";
txtContent += "PICKUP BRANCHES - ENGLISH KEYWORDS & COORDINATES FOR AI TRANSLATION / PROCESSING\r\n";
txtContent += "Total Branches: " + branches.length + "\r\n";
txtContent += "================================================================================\r\n\r\n";

const aiData = [];

branches.forEach((b, idx) => {
  const enKeywords = b.english_keywords_12km || [];
  const pipeEn = enKeywords.join(' | ');

  txtContent += `[BRANCH #${idx + 1}]\r\n`;
  txtContent += `Branch Code   : ${b.store_code || ''}\r\n`;
  txtContent += `Store Name    : ${b.store_name || ''}\r\n`;
  txtContent += `Province      : ${b.province_kh || ''}\r\n`;
  txtContent += `District (EN) : ${b.district_en || ''}\r\n`;
  txtContent += `District (KH) : ${b.district_kh || ''}\r\n`;
  txtContent += `Commune (KH)  : ${b.commune_kh || ''}\r\n`;
  txtContent += `NCDD Code     : ${b.commune_code || ''}\r\n`;
  txtContent += `Latitude      : ${b.latitude || ''}\r\n`;
  txtContent += `Longitude     : ${b.longitude || ''}\r\n`;
  txtContent += `English Keywords (${enKeywords.length}) :\r\n${pipeEn}\r\n`;
  txtContent += `--------------------------------------------------------------------------------\r\n\r\n`;

  aiData.push({
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
    english_keywords_count: enKeywords.length,
    english_keywords_pipe: pipeEn
  });
});

fs.writeFileSync(txtOutputPath, txtContent, 'utf-8');
console.log(`✅ Saved Notepad Text File (.txt): ${txtOutputPath}`);

fs.writeFileSync(jsonOutputPath, JSON.stringify(aiData, null, 2), 'utf-8');
console.log(`✅ Saved AI JSON File (.json): ${jsonOutputPath}`);

console.log('=== NOTEPAD EXPORT COMPLETE ===');
