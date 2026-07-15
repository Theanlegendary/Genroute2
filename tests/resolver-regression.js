/**
 * Cambodia Address Resolver - Regression Test Suite
 * Tests all critical edge cases to prevent regressions.
 * 
 * Run: node tests/resolver-regression.js
 */

'use strict';

const http = require('http');

const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;
const failures = [];

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: null });
        }
      });
    }).on('error', reject);
  });
}

async function resolve(query, province = '') {
  const qs = province ? `?q=${encodeURIComponent(query)}&province=${encodeURIComponent(province)}` : `?q=${encodeURIComponent(query)}`;
  const result = await fetchJson(`${BASE_URL}/api/google-geocode${qs}`);
  return result;
}

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    failures.push({ testName, details });
    console.log(`  ❌ FAIL: ${testName}`);
    if (details) console.log(`         ${details}`);
  }
}

function assertExact(result, testName) {
  const ok = result.status === 200 && result.body && !result.body.type;
  assert(ok, testName, `Got status=${result.status}, body.type=${result.body?.type}, name=${result.body?.name}`);
}

function assertAmbiguous(result, testName) {
  const ok = (result.status === 200 && result.body?.type === 'multiple') || result.status === 404;
  assert(ok, testName, `Got status=${result.status}, body.type=${result.body?.type}, name=${result.body?.name}`);
}

function assertNotFound(result, testName) {
  const ok = result.status === 404 || (result.body?.type === 'multiple' && result.body?.results?.length === 0);
  assert(ok, testName, `Got status=${result.status}, name=${result.body?.name}`);
}

function assertContains(result, searchStr, testName) {
  const name = (result.body?.name || '').toLowerCase();
  const resultsNames = (result.body?.results || []).map(r => (r.market || r.name || '').toLowerCase());
  const found = name.includes(searchStr.toLowerCase()) || resultsNames.some(n => n.includes(searchStr.toLowerCase()));
  assert(found, testName, `Expected "${searchStr}" in resolved name "${result.body?.name}" or results ${JSON.stringify(resultsNames)}`);
}

function assertNotContains(result, searchStr, testName) {
  const name = (result.body?.name || '').toLowerCase();
  const found = name.includes(searchStr.toLowerCase());
  assert(!found, testName, `Did NOT expect "${searchStr}" in resolved name "${result.body?.name}"`);
}

async function run() {
  console.log('\n=== Cambodia Address Resolver - Regression Tests ===\n');

  // ─────────────────────────────────────────────────
  // 1. EXACT MATCH LOCK
  // ─────────────────────────────────────────────────
  console.log('\n[1] Exact Match Lock Tests');

  let r = await resolve('វត្តភ្នំ');
  assertExact(r, 'Exact: វត្តភ្នំ → Wat Phnom');
  assertContains(r, 'phnom', 'Exact: Resolved name contains "phnom"');

  r = await resolve('ផ្សារអូឡាំពិច');
  assertExact(r, 'Exact: ផ្សារអូឡាំពិច → Olympic Market');
  assertContains(r, 'olympic', 'Exact: Resolved name contains "olympic"');

  r = await resolve('Olympic Market');
  assertExact(r, 'Exact Alias: Olympic Market (English) → Olympic Market');
  assertContains(r, 'olympic', 'Exact Alias: Resolved name contains "olympic"');

  r = await resolve('ស្ពានជ្រោយចង្វា');
  assertExact(r, 'Exact: ស្ពានជ្រោយចង្វា → Chroy Changvar Bridge');
  assertContains(r, 'chroy', 'Exact: Resolved name contains "chroy"');

  // ─────────────────────────────────────────────────
  // 2. FAMOUS LANDMARK PRIORITY
  // ─────────────────────────────────────────────────
  console.log('\n[2] Famous Landmark Priority Tests');

  r = await resolve('ផ្សារអូឡាំពិច');
  assertExact(r, 'Landmark: ផ្សារអូឡាំពិច resolves to Olympic Market');
  assert(!r.body?.type, 'Landmark: Should be exact, not ambiguous', `body.type=${r.body?.type}`);

  r = await resolve('Wat Phnom');
  assertExact(r, 'Landmark: Wat Phnom (English) resolves to Wat Phnom');
  assertContains(r, 'phnom', 'Landmark: Resolved name contains "phnom"');

  // ─────────────────────────────────────────────────
  // 3. EXACT KEYWORD – NO UNRELATED FUZZY MATCHES
  // ─────────────────────────────────────────────────
  console.log('\n[3] Keyword Mismatch Prevention Tests');

  r = await resolve('វត្តព្រះកែវ');
  if (r.status === 200 && !r.body?.type) {
    // If it resolved exactly, make sure it's NOT Prek Thleung
    assertNotContains(r, 'thleung', 'No match: វត្តព្រះកែវ must NOT resolve to ព្រែកថ្លឹង');
    assertNotContains(r, 'ក្ដ', 'No match: វត្តព្រះកែវ must NOT resolve to unrelated pagoda');
  } else {
    assertAmbiguous(r, 'Keyword Mismatch: វត្តព្រះកែវ (Preah Keo) must be Ambiguous or No Match, not a false positive');
  }

  r = await resolve('ព្រះកែវ');
  assertAmbiguous(r, 'Keyword: ព្រះកែវ alone → Ambiguous (multiple temples share the name)');

  // ─────────────────────────────────────────────────
  // 4. NUMERIC TOKEN EXACT MATCHING
  // ─────────────────────────────────────────────────
  console.log('\n[4] Numeric Token Exact Match Tests');

  r = await resolve('ផ្លូវ 271');
  if (r.status === 200 && !r.body?.type) {
    const name = (r.body?.name || '').replace(/\D/g, '');
    assert(name.includes('271'), 'Numeric: ផ្លូវ 271 resolved name contains 271', `name="${r.body?.name}"`);
    assert(!name.includes('27') || name.includes('271'), 'Numeric: ផ្លូវ 271 must not match ផ្លូវ 27', `name="${r.body?.name}"`);
  } else {
    assertAmbiguous(r, 'Numeric: ផ្លូវ 271 → Ambiguous or No Match (acceptable if no 271 in DB)');
  }

  // Khmer numerals
  r = await resolve('ផ្លូវ ២៧១');
  if (r.status === 200 && !r.body?.type) {
    const name = (r.body?.name || '').replace(/[^a-z0-9]/gi, '');
    assert(name.toLowerCase().includes('271'), 'Numeric Khmer: ២៧១ normalized to 271', `name="${r.body?.name}"`);
  } else {
    assertAmbiguous(r, 'Numeric Khmer: ផ្លូវ ២៧១ → Ambiguous or No Match (acceptable)');
  }

  // Alphanumeric road
  r = await resolve('ផ្លូវ 6A');
  if (r.status === 200 && !r.body?.type) {
    assertContains(r, '6a', 'Alphanumeric Road: ផ្លូវ 6A resolved name contains 6a');
  } else {
    assertAmbiguous(r, 'Alphanumeric Road: ផ្លូវ 6A → Ambiguous or No Match');
  }

  // ─────────────────────────────────────────────────
  // 5. OBJECT TYPE FILTERING
  // ─────────────────────────────────────────────────
  console.log('\n[5] Object Type Filtering Tests');

  r = await resolve('ក្រោយវត្តស្ទឹងមានជ័យ');
  assertExact(r, 'Type: ក្រោយវត្តស្ទឹងមានជ័យ resolves to pagoda, not nearby business');
  if (r.status === 200 && r.body) {
    assertNotContains(r, 'opennet', 'Type: Must NOT resolve to OPENNET business');
    assertNotContains(r, 'pharmacy', 'Type: Must NOT resolve to pharmacy near pagoda');
  }

  r = await resolve('ស្ពានជ្រោយចង្វារ');
  assertExact(r, 'Type: Bridge query resolves to bridge, not business');
  if (r.status === 200 && r.body) {
    assertContains(r, 'chroy', 'Type: Bridge resolved name contains "chroy"');
  }

  // ─────────────────────────────────────────────────
  // 6. GENERIC NAMES → AMBIGUOUS
  // ─────────────────────────────────────────────────
  console.log('\n[6] Generic Name Ambiguity Tests');

  r = await resolve('វត្តថ្មី');
  assertAmbiguous(r, 'Generic: "វត្តថ្មី" without province → Ambiguous');

  r = await resolve('ផ្សារថ្មី');
  assertAmbiguous(r, 'Generic: "ផ្សារថ្មី" without province → Ambiguous');

  // With province context, should resolve
  r = await resolve('ផ្សារថ្មី', 'Phnom Penh');
  // This may still be ambiguous if multiple exist in PP - that's acceptable
  assert(r.status === 200, 'Generic + Province: "ផ្សារថ្មី" in Phnom Penh → returns 200');

  // ─────────────────────────────────────────────────
  // 7. CHAIN BUSINESSES → AMBIGUOUS
  // ─────────────────────────────────────────────────
  console.log('\n[7] Chain Business Ambiguity Tests');

  r = await resolve('AEON');
  assertAmbiguous(r, 'Chain: AEON alone → Ambiguous (needs location)');

  r = await resolve('ABA');
  assertAmbiguous(r, 'Chain: ABA alone → Ambiguous (needs location)');

  r = await resolve('Wing');
  assertAmbiguous(r, 'Chain: Wing alone → Ambiguous (needs location)');

  // Chain with location should resolve
  r = await resolve('AEON Mall Meanchey');
  assert(r.status === 200, 'Chain + Location: AEON Mall Meanchey → returns 200');

  // ─────────────────────────────────────────────────
  // 8. PROVINCE BOUNDARY ENFORCEMENT
  // ─────────────────────────────────────────────────
  console.log('\n[8] Province Boundary Enforcement Tests');

  r = await resolve('ផ្សារដើមគរ', 'Phnom Penh');
  assertExact(r, 'Province: Phsar Daeum Kor in PP resolves correctly');

  r = await resolve('បឹងកេងកង');
  assertExact(r, 'Province: BKK resolves to Phnom Penh, not other province');
  if (r.status === 200 && r.body) {
    const prov = (r.body.province || '').toLowerCase();
    assert(prov.includes('phnom penh'), 'Province: BKK province is Phnom Penh', `province="${r.body.province}"`);
  }

  // ─────────────────────────────────────────────────
  // 9. ALIAS NORMALIZATION
  // ─────────────────────────────────────────────────
  console.log('\n[9] Alias Normalization Tests');

  r = await resolve('ពេទ្យរុស្ស៊ី');
  assertExact(r, 'Alias: ពេទ្យរុស្ស៊ី → Khmer-Soviet Friendship Hospital');
  if (r.status === 200 && r.body) {
    const name = (r.body.name || '').toLowerCase();
    assert(name.includes('soviet') || name.includes('friendship') || name.includes('russe'), 
      'Alias: Resolved name contains "soviet" or "friendship"', `name="${r.body.name}"`);
  }

  // ─────────────────────────────────────────────────
  // 10. KHMER ↔ ENGLISH NAME MATCHING
  // ─────────────────────────────────────────────────
  console.log('\n[10] Khmer ↔ English Name Matching Tests');

  r = await resolve('Central Market');
  assertExact(r, 'KhEn: Central Market (English) resolves correctly');
  assertContains(r, 'central', 'KhEn: Resolved name contains "central"');

  r = await resolve('ផ្សារធំថ្មី');
  assertExact(r, 'KhEn: ផ្សារធំថ្មី (Khmer) resolves correctly');

  // ─────────────────────────────────────────────────
  // 11. PHONE NUMBERS IGNORED
  // ─────────────────────────────────────────────────
  console.log('\n[11] Phone Number Ignored Tests');

  r = await resolve('081391155 ក្បែរស្ពានជ្រោយចង្វារ');
  assert(r.status === 200, 'Phone: Query with phone prefix returns 200');
  if (r.status === 200 && r.body) {
    assertContains(r, 'chroy', 'Phone: Resolved name contains "chroy" (phone was stripped)');
  }

  // ─────────────────────────────────────────────────
  // 12. MIXED KHMER + ENGLISH
  // ─────────────────────────────────────────────────
  console.log('\n[12] Mixed Khmer + English Tests');

  r = await resolve('AEON Mall ភ្នំពេញ');
  assert(r.status === 200, 'Mixed: AEON Mall ភ្នំពេញ returns 200');

  r = await resolve('ក្តាន់ 2 Landmark');
  assertExact(r, 'Mixed: ក្តាន់ 2 Landmark resolves correctly');

  // ─────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);

  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.testName}`);
      if (f.details) console.log(`     ${f.details}`);
    });
  }

  console.log('\n' + '='.repeat(50) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
