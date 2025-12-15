// server-test.js
// BossMind DeepSeek Orchestrator (ES Module)
// - Runs on http://localhost:5001
// - Health: GET  /api/health
// - Chat:   POST /api/deepseek/chat
//   Body: { "messages": [ { "role": "user", "content": "..." }, ... ] }

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// --------- CONFIG ---------
const app = express();
const PORT = 5001;

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions';

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 20000;

// --------- MIDDLEWARE ---------
app.use(cors());

app.use(
  express.json({
    strict: false,
    verify: (req, res, buf, encoding) => {
      try {
        if (buf && buf.length > 0) {
          JSON.parse(buf.toString(encoding || 'utf8'));
        }
      } catch (e) {
        console.warn('Invalid JSON received:', e.message);
        // allow request to hit handler, which will return 400
      }
    },
  })
);

// log basic info for every request
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} [${req.method}] ${req.url} - ${req.ip}`
  );
  next();
});

// --------- HEALTH CHECK ---------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    server: 'BossMind DeepSeek Orchestrator',
    port: PORT,
    nodeVersion: process.version,
    deepseek: {
      configured: Boolean(DEEPSEEK_API_KEY),
      model: DEEPSEEK_MODEL,
      baseUrl: DEEPSEEK_BASE_URL,
    },
  });
});

// --------- DEEPSEEK CALLER ---------
async function callDeepSeek(messages, opts = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Add it to your environment or .env file.'
    );
  }

  const maxRetries = opts.maxRetries ?? MAX_RETRIES;
  const model = opts.model ?? DEEPSEEK_MODEL;

  // shape into OpenAI-style messages
  const deepseekMessages = messages.map((m) => ({
    role: m.role || 'user',
    content: m.content || '',
  }));

  const body = {
    model,
    messages: deepseekMessages,
    stream: false,
  };

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      console.log(
        `Calling DeepSeek (attempt ${attempt}/${maxRetries}) model=${model}`
      );

      const resp = await fetch(DEEPSEEK_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const text = await resp.text();
        const snippet = text.slice(0, 400);
        throw new Error(
          `DeepSeek HTTP ${resp.status} ${resp.statusText}: ${snippet}`
        );
      }

      const data = await resp.json();
      const choice = data.choices?.[0]?.message;
      const replyText = choice?.content || '';

      console.log(
        `DeepSeek responded: ${
          replyText.length > 150
            ? replyText.slice(0, 150) + '...'
            : replyText
        }`
      );

      return {
        raw: data,
        replyText,
      };
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      console.error(
        `DeepSeek call failed (attempt ${attempt}/${maxRetries}):`,
        err.message
      );
      if (attempt === maxRetries) {
        throw err;
      }
      // small delay before retry
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError || new Error('DeepSeek call failed for unknown reason');
}

// --------- CHAT ENDPOINT ---------
app.post('/api/deepseek/chat', async (req, res) => {
  try {
    const body = req.body || {};
    console.log(
      'Received /api/deepseek/chat body:',
      JSON.stringify(body, null, 2)
    );

    // flexible messages acceptance
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Empty request body',
        message: 'Please send JSON with "messages" array',
      });
    }

    const { messages } = body;

    if (!messages) {
      return res.status(400).json({
        ok: false,
        error: 'Missing messages field',
        details: 'Request must contain "messages" field',
        receivedKeys: Object.keys(body),
      });
    }

    const messagesArray = Array.isArray(messages) ? messages : [messages];

    const validMessages = [];
    for (const msg of messagesArray) {
      if (msg && typeof msg === 'object') {
        const role = msg.role || 'user';
        const content = msg.content || '';
        if (content.trim()) {
          validMessages.push({ role, content });
        }
      }
    }

    if (validMessages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No valid messages',
        details:
          'Messages must contain at least one object with non-empty "content" field',
      });
    }

    // --- call DeepSeek orchestrator ---
    const start = Date.now();
    const deepseekResult = await callDeepSeek(validMessages);
    const durationMs = Date.now() - start;

    // response to frontend
    return res.json({
      ok: true,
      message: 'DeepSeek reply generated successfully',
      tookMs: durationMs,
      assistantReply: deepseekResult.replyText,
      messages: validMessages,
      receivedBody: body,
      model: DEEPSEEK_MODEL,
      meta: {
        note:
          'BossMind Orchestrator: this endpoint validates JSON, calls DeepSeek, and echoes messages.',
      },
      raw: deepseekResult.raw, // you can remove this in production if too large
    });
  } catch (err) {
    console.error('Route /api/deepseek/chat error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      details: err.message,
    });
  }
});

// --------- 404 + ERROR HANDLERS ---------
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `Route not found: ${req.method} ${req.url}`,
    availableRoutes: ['GET /api/health', 'POST /api/deepseek/chat'],
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// --------- START SERVER ---------
const server = app.listen(PORT, () => {
  console.log('=========================================');
  console.log(`BossMind test server listening on http://localhost:${PORT}`);
  console.log(`Health check: GET  http://localhost:${PORT}/api/health`);
  console.log(`Chat test:   POST http://localhost:${PORT}/api/deepseek/chat`);
  console.log('=========================================');
});

// graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down BossMind DeepSeek server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
