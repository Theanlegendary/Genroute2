const fetch = require('node-fetch');

async function crawlGoogleMapsCoords(query) {
  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,km;q=0.8',
        'Accept-Encoding': 'identity'
      }
    });

    const finalUrl = response.url;
    console.log(`Final URL: ${finalUrl}`);
    const urlMatch = finalUrl.match(/@([-+]?\d+\.\d+),([-+]?\d+\.\d+)/);
    if (urlMatch) {
      return { lat: parseFloat(urlMatch[1]), lng: parseFloat(urlMatch[2]), source: 'url' };
    }
    const html = await response.text();
    const staticMapMatch = html.match(/center=([-+]?\d+\.\d+)(?:%2C|,)([-+]?\d+\.\d+)/i);
    if (staticMapMatch) {
      return { lat: parseFloat(staticMapMatch[1]), lng: parseFloat(staticMapMatch[2]), source: 'static_map' };
    }
  } catch (err) {
    console.error('Crawl failed:', err.message);
  }
  return null;
}

async function run() {
  const res = await crawlGoogleMapsCoords('2004 street, Cambodia');
  console.log('Result:', res);
}
run();
