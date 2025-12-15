// lib/bossmindClient.js
// BossMind DeepSeek Orchestrator – simple Node.js client wrapper
// Works with: http://localhost:5001/api/health and /api/deepseek/chat

import axios from 'axios';

const DEFAULT_BASE_URL =
  process.env.BOSSMIND_BASE_URL || 'http://localhost:5001';

export class BossmindClient {
  /**
   * @param {Object} options
   * @param {string} [options.baseURL] - Orchestrator base URL
   * @param {number} [options.timeout] - Request timeout in ms
   * @param {string} [options.apiKey] - Optional API key (for future use)
   */
  constructor(options = {}) {
    this.baseURL = options.baseURL || DEFAULT_BASE_URL;
    this.timeout = options.timeout || 30000;
    this.apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || null;

    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Health check – calls /api/health on the orchestrator
   */
  async health() {
    const res = await this.http.get('/api/health');
    return res.data;
  }

  /**
   * Full chat call – send your own messages array
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [options]
   * @param {string} [options.model] - DeepSeek model name
   * @param {Object} [options.meta]  - Extra meta data
   */
  async chat(messages, options = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages must be a non-empty array');
    }

    const payload = {
      messages,
      model: options.model || 'deepseek-chat',
      meta: options.meta || {}
    };

    const res = await this.http.post('/api/deepseek/chat', payload);
    return res.data;
  }

  /**
   * Convenience helper – simple user message
   * @param {string} prompt
   * @param {Object} [options]
   */
  async ask(prompt, options = {}) {
    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];
    return this.chat(messages, options);
  }
}

/**
 * Quick helper functions (no need to create a class instance)
 */

export async function bossmindHealth(config = {}) {
  const client = new BossmindClient(config);
  return client.health();
}

export async function bossmindChat(promptOrMessages, config = {}) {
  const client = new BossmindClient(config);

  // If string -> treat as single user message
  if (typeof promptOrMessages === 'string') {
    return client.ask(promptOrMessages);
  }

  // If array -> pass through
  return client.chat(promptOrMessages);
}

