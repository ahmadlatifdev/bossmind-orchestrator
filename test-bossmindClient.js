// test-bossmindClient.js
// Quick test of the BossMind client wrapper

import { BossmindClient } from './lib/bossmindClient.js';

async function main() {
  try {
    const client = new BossmindClient();

    console.log('--- BossMind client: health check ---');
    const health = await client.health();
    console.log(health);

    console.log('\n--- BossMind client: chat test ---');
    const reply = await client.ask(
      'Hello BossMind, this is a test from the Node.js client wrapper.'
    );

    console.log(JSON.stringify(reply, null, 2));
  } catch (err) {
    console.error('Error while testing bossmindClient:', err);
    process.exitCode = 1;
  }
}

main();
