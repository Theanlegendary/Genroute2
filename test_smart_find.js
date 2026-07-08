const fetch = require('node-fetch');

const PORT = 3000;
const API = `http://127.0.0.1:${PORT}`;

const testCases = [
  { name: 'Direct Coordinates Search', query: '11.5696, 104.9211' },
  { name: 'Khmer Market Search', query: 'ផ្សារធំថ្មី' },
  { name: 'Spelling Correction Search', query: 'Phsar Thmey' },
  { name: 'Famous Market Static Override', query: 'Ang Tasom' },
  { name: 'Standard Province Market Search', query: 'Kampong Cham Market', province: 'Kampong Cham' },
  { name: 'Khmer Village Prefix Stripping Search', query: 'ភូមិត្នោត', province: 'Prey Veng' },
  { name: 'Khmer District Prefix Stripping Search', query: 'ស្រុកកញ្ជ្រៀច', province: 'Prey Veng' }
];

async function runTests() {
  console.log('🧪 Starting Smart-Find Pipeline Verification Tests...\n');

  for (const tc of testCases) {
    console.log(`=========================================`);
    console.log(`CASE: ${tc.name}`);
    console.log(`QUERY: "${tc.query}"` + (tc.province ? ` (Province: ${tc.province})` : ''));
    console.log(`=========================================`);

    try {
      const params = new URLSearchParams({ q: tc.query });
      if (tc.province) params.append('province', tc.province);

      const res = await fetch(`${API}/api/smart-find?${params}`);
      if (!res.ok) {
        const errText = await res.text();
        console.log(`❌ FAILED (HTTP ${res.status}):`, errText);
        continue;
      }

      const data = await res.json();
      console.log(`✅ SUCCESS!`);
      console.log(`   Resolved Location Name: "${data.resolved_market?.market || 'N/A'}"`);
      console.log(`   Coordinates: Latitude ${data.found_coords?.lat}, Longitude ${data.found_coords?.lng}`);
      console.log(`   Source: ${data.coords_source}`);
      console.log(`   Assigned Branch Code: ${data.default_assigned_post_office?.branch_id || 'N/A'}`);
      console.log(`   Nearest Post Office: "${data.nearest_post_office?.market}" (${data.nearest_post_office?.branch_id}) at distance ${data.distance_km} km`);
    } catch (err) {
      console.log(`❌ ERROR:`, err.message);
    }
    console.log('\n');
  }
}

// Wait 1 second before starting to ensure server is ready
setTimeout(runTests, 1000);
