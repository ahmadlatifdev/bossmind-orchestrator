/**
 * =========================================
 * BossMind — core/modelRouter.js (ESM)
 * Authority Gate: V3 (Orchestrator) vs Coder (Implementer)
 * =========================================
 */

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUserText(messages = []) {
  return messages
    .filter((m) => m && m.role === 'user')
    .map((m) => normalizeText(m.content))
    .join(' | ');
}

function looksLikeImplementationRequest(text) {
  const strongSignals = [
    'provide complete updated file',
    'full file',
    'complete file',
    'replace the file',
    'update this file',
    'edit this file',
    'modify this file',
    'fix this code',
    'write the code',
    'generate the code',
    'create the file',
    'add a new file',
    'patch',
    'diff',
    'implement',
    'refactor',
    'rewrite',
    'make changes to',
    'update the project',
    'update the repo',
    'update the module',
    'add endpoint',
    'add route',
    'create api',
    'create function',
    'create component',
    'create script',
    'create middleware',
    'update server.js',
    'update router',
    'update guard',
    'typescript',
    'javascript',
    'node.js',
    'express',
  ];

  const codeSignals = [
    '```',
    'const ',
    'function ',
    'class ',
    'import ',
    'export ',
    'require(',
    'app.get(',
    'app.post(',
    'module.exports',
    'package.json',
    'server.js',
    '.env',
    'error:',
    'stack trace',
  ];

  if (strongSignals.some((s) => text.includes(s))) return true;

  const codeHits = codeSignals.reduce((acc, s) => acc + (text.includes(s) ? 1 : 0), 0);
  return codeHits >= 2;
}

export default function modelRouter(messages = []) {
  const text = extractUserText(messages);

  const V3_MODEL = process.env.DEEPSEEK_V3_MODEL || 'deepseek-v3';
  const CODER_MODEL = process.env.DEEPSEEK_CODER_MODEL || 'deepseek-coder-v2';

  let selected = V3_MODEL;
  let reason = 'default_orchestrator_authority';

  if (looksLikeImplementationRequest(text)) {
    selected = CODER_MODEL;
    reason = 'explicit_implementation_request';
  }

  return { model: selected, reason };
}
