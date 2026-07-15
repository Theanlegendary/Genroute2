const assert = require('assert');
const { spawn } = require('child_process');

const PORT = process.env.TEST_PORT || '3137';
const BASE_URL = `http://127.0.0.1:${PORT}`;

function startServer() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT,
      DISABLE_GEOCODING_CACHE: '1',
      GEMINI_API_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    output += chunk.toString();
  });

  child.output = () => output;
  return child;
}

async function waitForServer(child) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with ${child.exitCode}\n${child.output()}`);
    }

    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Server did not start: ${lastError ? lastError.message : 'timeout'}\n${child.output()}`);
}

async function geocode(query) {
  const res = await fetch(`${BASE_URL}/api/google-geocode?q=${encodeURIComponent(query)}`);
  assert.strictEqual(res.status, 200, `${query} should return HTTP 200`);
  return res.json();
}

function assertExactLocation(query, result, expected) {
  assert.notStrictEqual(result.type, 'multiple', `${query} should resolve to one curated location`);
  assert.ok(Number.isFinite(Number(result.lat)), `${query} should include latitude`);
  assert.ok(Number.isFinite(Number(result.lng)), `${query} should include longitude`);

  if (expected.type) {
    assert.strictEqual(result.object_type, expected.type, `${query} should resolve as ${expected.type}`);
  }

  if (expected.nameIncludes) {
    const name = `${result.name || ''} ${result.reason || ''}`.toLowerCase();
    assert.ok(name.includes(expected.nameIncludes.toLowerCase()), `${query} should include ${expected.nameIncludes}; got ${result.name}`);
  }

  if (expected.notNameIncludes) {
    const name = `${result.name || ''} ${result.reason || ''}`.toLowerCase();
    assert.ok(!name.includes(expected.notNameIncludes.toLowerCase()), `${query} should not include ${expected.notNameIncludes}; got ${result.name}`);
  }
}

function assertAmbiguousChain(query, result) {
  assert.strictEqual(result.type, 'multiple', `${query} should return an ambiguous list`);
  assert.ok(Array.isArray(result.results), `${query} should include ambiguous results`);
  assert.ok(result.results.length >= 1, `${query} should include at least one ambiguous option`);
}

async function main() {
  const server = startServer();

  try {
    await waitForServer(server);

    const exactCases = [
      ['វត្តភ្នំ', { type: 'pagoda', nameIncludes: 'Wat Phnom' }],
      ['ស្ពានជ្រោយចង្វា', { type: 'bridge', nameIncludes: 'Chroy Changvar Bridge' }],
      ['ស្ពានមិត្តភាពកម្ពុជា-ជប៉ុន', { type: 'bridge', nameIncludes: 'Chroy Changvar Bridge' }],
      ['ស្ពានអាកាសស្ទឹងមានជ័យ', { type: 'bridge', nameIncludes: 'Steung Meanchey Flyover' }],
      ['ផ្លូវ2004', { type: 'road', nameIncludes: 'Street 2004', notNameIncludes: 'St P04' }]
    ];

    for (const [query, expected] of exactCases) {
      const result = await geocode(query);
      assertExactLocation(query, result, expected);
    }

    for (const query of ['AEON', 'ABA', 'ACLEDA', 'Wing']) {
      const result = await geocode(query);
      assertAmbiguousChain(query, result);
    }

    console.log('Resolver regression tests passed.');
  } finally {
    if (server.exitCode === null) {
      server.kill();
    }
  }
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
