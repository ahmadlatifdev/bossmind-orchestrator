/**
 * Server/services/store.cjs
 * Simple transaction store (in-memory) + optional JSONL file log.
 *
 * NOTE: Railway filesystem is ephemeral; this is mainly for debugging.
 * Recommended: later persist into Supabase (we can add that next).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_IN_MEMORY = 500;
const mem = []; // newest last

const LOG_DIR = process.env.BOSSMIND_LOG_DIR || '/tmp/bossmind';
const TX_LOG_FILE = path.join(LOG_DIR, 'tax-transactions.jsonl');

function ensureDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (_) {}
}

async function storeTransaction(tx) {
  if (!tx || !tx.id) throw new Error('Invalid transaction');

  // in-memory
  mem.push(tx);
  while (mem.length > MAX_IN_MEMORY) mem.shift();

  // optional file log
  ensureDir();
  try {
    fs.appendFileSync(TX_LOG_FILE, JSON.stringify(tx) + '\n', 'utf8');
  } catch (e) {
    console.warn('[Store] append log failed:', e?.message || e);
  }
}

async function getStoreStats() {
  return {
    in_memory_count: mem.length,
    jsonl_path: TX_LOG_FILE,
  };
}

async function listRecentTransactions(limit = 25) {
  const slice = mem.slice(Math.max(0, mem.length - limit));
  // show newest first
  return slice.reverse();
}

module.exports = {
  storeTransaction,
  getStoreStats,
  listRecentTransactions,
};
