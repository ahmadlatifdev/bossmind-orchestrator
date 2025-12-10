// self-check.cjs
// BossMind Orchestrator – Local Health Checker (Backend + Frontend)
// Node 22+ has global fetch, we use it for simpler diagnostics.

async function get(url) {
  const res = await fetch(url);
  const data = await res.text();
  return { url, status: res.status, data };
}

async function safeCheck(name, url, extraCheck) {
  console.log(`${name}`);
  try {
    const res = await get(url);
    console.log('   URL        :', url);
    console.log('   Status Code:', res.status);

    let note = '';
    if (typeof extraCheck === 'function') {
      note = extraCheck(res.data);
    }

    console.log('   Body/sample:', res.data.slice(0, 120).replace(/\s+/g, ' ') + (res.data.length > 120 ? '...' : ''));
    if (res.status === 200) {
      console.log('   ✅ OK', note ? `(${note})` : '');
    } else {
      console.log('   ⚠ Non-200 status', note ? `(${note})` : '');
    }
  } catch (e) {
    console.log('   ❌ Error:', e && e.message ? e.message : e);
  }
  console.log();
}

async function runChecks() {
  console.log('==============================');
  console.log(' BossMind Orchestrator – Check');
  console.log('==============================\n');

  await safeCheck(
    '1) Backend /api/health',
    'http://localhost:5000/api/health',
    (body) => (body.includes('"status":"ok"') ? 'status: ok detected' : '')
  );

  await safeCheck(
    '2) DeepSeek Status',
    'http://localhost:5000/api/deepseek/status',
    (body) => (body.includes('"online":true') ? 'DeepSeek online=true' : 'DeepSeek online=false or missing')
  );

  await safeCheck(
    '3) Frontend Dashboard',
    'http://localhost:3000/',
    (body) => (body.includes('BossMind Orchestrator') ? 'title found' : 'title not found')
  );

  console.log('--- Check complete ---');
}

runChecks().catch((err) => {
  console.error('Unexpected error in self-check:', err);
});
