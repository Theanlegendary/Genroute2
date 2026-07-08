const fetch = require('node-fetch');

async function testGeocode(query) {
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=kh&limit=5`;
    const res = await fetch(nomUrl, {
      headers: {
        'User-Agent': 'MetfoneExpressBranchLocator/1.0 (contact@metfone.com.kh)'
      }
    });
    const data = await res.json();
    console.log(`QUERY: [${query}]`);
    data.forEach((r, idx) => {
      console.log(`  ${idx+1}. Name: ${r.name || r.display_name}, coords: ${r.lat}, ${r.lon}`);
    });
    return data;
  } catch (err) {
    console.error('Error:', err.message);
    return [];
  }
}

async function testGoogleAutocomplete(query) {
  try {
    const autocompleteUrl = `https://clients1.google.com/complete/search?client=chrome&hl=km&gl=kh&q=${encodeURIComponent(query)}`;
    const res = await fetch(autocompleteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Encoding': 'identity'
      }
    });
    const data = await res.json();
    const suggestions = data[1] || [];
    console.log(`\nGOOGLE AUTOCOMPLETE FOR [${query}]:`);
    suggestions.forEach((s, idx) => {
      console.log(`  ${idx+1}. ${s}`);
    });
    
    // Now let's try to geocode the suggestions!
    for (const sugg of suggestions.slice(0, 5)) {
      console.log(`\nGeocoding suggestion: [${sugg}]`);
      await testGeocode(sugg);
    }
  } catch (err) {
    console.error('Autocomplete Error:', err.message);
  }
}

async function run() {
  console.log('--- TEST NOMINATIM DIRECT ---');
  await testGeocode('Chbar Ampov, Batheay');
  await testGeocode('Chbar Ampov, Kampong Cham');
  await testGeocode('ច្បារអំពៅ បាធាយ');
  await testGeocode('បាធាយ កំពង់ចាម');
  await testGeocode('Batheay');
}
run();
