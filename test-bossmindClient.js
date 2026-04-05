// test-ResumeAIClient.js
// Quick test of the ResumeAI client wrapper

import { ResumeAIClient } from './lib/ResumeAIClient.js';

async function main() {
  try {
    const client = new ResumeAIClient();

    console.log('--- ResumeAI client: health check ---');
    const health = await client.health();
    console.log(health);

    console.log('\n--- ResumeAI client: chat test ---');
    const reply = await client.ask(
      'Hello ResumeAI, this is a test from the Node.js client wrapper.'
    );

    console.log(JSON.stringify(reply, null, 2));
  } catch (err) {
    console.error('Error while testing ResumeAIClient:', err);
    process.exitCode = 1;
  }
}

main();

