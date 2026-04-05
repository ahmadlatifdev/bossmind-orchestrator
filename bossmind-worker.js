'use strict';

require('dotenv').config();

const { Pool } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.BOSSMIND_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[BossMindWorker][FATAL] Missing DATABASE_URL or BOSSMIND_DATABASE_URL in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const POLL_INTERVAL_MS = 5000;
let isProcessing = false;

function log(...args) {
  console.log('[BossMindWorker]', ...args);
}

function error(...args) {
  console.error('[BossMindWorker][ERROR]', ...args);
}

async function processNextQueueItem() {
  if (isProcessing) return;
  isProcessing = true;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const selectSql = `
      SELECT id, task_id, payload, status, created_at
      FROM bossmind_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const result = await client.query(selectSql);

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      isProcessing = false;
      return;
    }

    const job = result.rows[0];

    await client.query(
      `
      UPDATE bossmind_queue
      SET status = 'processing',
          started_at = NOW()
      WHERE id = $1
      `,
      [job.id]
    );

    await client.query(
      `
      INSERT INTO bossmind_task_runs (
        task_id,
        status,
        started_at,
        created_at
      )
      VALUES ($1, $2, NOW(), NOW())
      `,
      [job.task_id, 'processing']
    );

    await client.query('COMMIT');

    log(`Processing queue item ${job.id} for task ${job.task_id}`);

    let finalStatus = 'completed';

    try {
      log('Payload:', JSON.stringify(job.payload || {}));

      await pool.query(
        `
        UPDATE bossmind_queue
        SET status = 'completed',
            finished_at = NOW()
        WHERE id = $1
        `,
        [job.id]
      );

      await pool.query(
        `
        UPDATE bossmind_task_runs
        SET status = 'completed',
            finished_at = NOW()
        WHERE task_id = $1
          AND status = 'processing'
        `,
        [job.task_id]
      );

      log(`Completed queue item ${job.id}`);
    } catch (jobError) {
      finalStatus = 'failed';

      await pool.query(
        `
        UPDATE bossmind_queue
        SET status = 'failed',
            finished_at = NOW()
        WHERE id = $1
        `,
        [job.id]
      );

      await pool.query(
        `
        UPDATE bossmind_task_runs
        SET status = 'failed',
            finished_at = NOW()
        WHERE task_id = $1
          AND status = 'processing'
        `,
        [job.task_id]
      );

      error(`Failed queue item ${job.id}:`, jobError.message);
    }

    log(`Final status for ${job.id}: ${finalStatus}`);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    error(e.message);
  } finally {
    client.release();
    isProcessing = false;
  }
}

async function heartbeat() {
  try {
    const res = await pool.query('SELECT NOW() AS now');
    log(`Worker alive at ${res.rows[0].now}`);
  } catch (e) {
    error('Heartbeat failed:', e.message);
  }
}

async function start() {
  try {
    const test = await pool.query('SELECT NOW() AS now');
    log(`Queue worker started. DB connected at ${test.rows[0].now}`);
  } catch (e) {
    error('Database connection failed:', e.message);
    process.exit(1);
  }

  await processNextQueueItem();

  setInterval(processNextQueueItem, POLL_INTERVAL_MS);
  setInterval(heartbeat, 60000);
}

process.on('SIGINT', async () => {
  log('Stopping worker...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('Stopping worker...');
  await pool.end();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  error('Uncaught exception:', err);
  process.exit(1);
});

start();