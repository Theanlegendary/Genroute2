/**
 * UPLOAD TXT FILES TO ONLINE PASTEBIN SERVICE (DPASTE.COM)
 * Uploads:
 *  1. BRANCH_KEYWORDS_ENGLISH_ONLY.txt
 *  2. BRANCH_DATA_NO_KEYWORDS.txt
 * Returns public shareable URL links for direct copy-pasting into AI!
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const kwTxtPath = path.join(ROOT_DIR, 'BRANCH_KEYWORDS_ENGLISH_ONLY.txt');
const noKwTxtPath = path.join(ROOT_DIR, 'BRANCH_DATA_NO_KEYWORDS.txt');

const kwContent = fs.readFileSync(kwTxtPath, 'utf-8');
const noKwContent = fs.readFileSync(noKwTxtPath, 'utf-8');

console.log('=== UPLOADING FILES TO DPASTE PASTEBIN SERVICE ===');

async function uploadToDpaste(title, content) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('content', content.substring(0, 400000));
  formData.append('expiry', '2592000'); // 30 Days

  const res = await fetch('https://dpaste.com/api/v2/', {
    method: 'POST',
    headers: { 'User-Agent': 'MetfoneGenRouteEngine/1.0' },
    body: formData
  });

  if (res.status === 201 || res.ok) {
    const pasteUrl = (await res.text()).trim();
    return pasteUrl;
  } else {
    throw new Error(`Failed with status ${res.status}`);
  }
}

async function run() {
  try {
    const kwUrl = await uploadToDpaste('Pickup Branches - Top English Keywords & Streets', kwContent);
    console.log('✅ Top English Keywords Bin Paste Link:', kwUrl);

    const noKwUrl = await uploadToDpaste('Pickup Branches - Clean Master Data (No Keywords)', noKwContent);
    console.log('✅ Clean Master Data (No Keywords) Bin Paste Link:', noKwUrl);

    // Write links to a text file for reference
    const linksSummary = `PASTEBIN LINKS FOR AI COPY-PASTING:\r\n\r\n1. Top English Keywords & Major Streets Paste Link:\r\n${kwUrl}\r\n\r\n2. Clean Master Data (No Keywords) Paste Link:\r\n${noKwUrl}\r\n\r\nRaw GitHub File Link:\r\nhttps://raw.githubusercontent.com/Theanlegendary/Mapmfe/main/BRANCH_KEYWORDS_ENGLISH_ONLY.txt\r\n`;

    fs.writeFileSync(path.join(ROOT_DIR, 'PASTEBIN_LINKS.txt'), linksSummary, 'utf-8');
    console.log('Saved PASTEBIN_LINKS.txt');
  } catch (e) {
    console.error('Upload Error:', e);
  }
}

run();
