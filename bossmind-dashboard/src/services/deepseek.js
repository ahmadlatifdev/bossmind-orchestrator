// src/services/deepseek.js
// Unified DeepSeek API integration used by App.js

import { DEEPSEEK_KEYS, SYSTEM_CONFIG } from "../config/keys.js";

// ---------------------------
// 🔧 Base constants
// ---------------------------
const API_BASE_URL = "https://api.deepseek.com/v1";

export const DEEPSEEK_MODELS = {
  CHAT: "deepseek-chat",
  CODER: "deepseek-coder",
  REASONER: "deepseek-reasoner"
};

// ---------------------------
// 💼 Core service class
// ---------------------------
class DeepSeekService {
  constructor(apiKeyType = "CORE") {
    const key = DEEPSEEK_KEYS && DEEPSEEK_KEYS[apiKeyType];

    if (!key) {
      // eslint-disable-next-line no-console
      console.warn(`DeepSeek API key for type "${apiKeyType}" is missing.`);
    }

    this.apiKey = key || "";
    this.baseUrl = API_BASE_URL;
  }

  // Internal helper
  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.headers || {})
      },
      body:
        options.method && options.method.toUpperCase() === "GET"
          ? undefined
          : JSON.stringify(options.body || {})
    });

    if (!response.ok) {
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error("DeepSeek API error:", errorText);
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    return response.json();
  }

  // Chat completion
  async chat({ prompt, system, model } = {}) {
    const usedModel =
      model ||
      (SYSTEM_CONFIG &&
        SYSTEM_CONFIG.MODELS &&
        SYSTEM_CONFIG.MODELS.DEFAULT) ||
      DEEPSEEK_MODELS.CHAT;

    const messages = [];

    if (system) {
      messages.push({ role: "system", content: system });
    }

    messages.push({ role: "user", content: prompt });

    const data = await this._request("/chat/completions", {
      body: {
        model: usedModel,
        messages
      }
    });

    const choice =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    return (choice || "").trim();
  }

  // Embeddings
  async embed(text, model = "deepseek-embed") {
    const data = await this._request("/embeddings", {
      body: {
        model,
        input: text
      }
    });

    if (
      data &&
      data.data &&
      data.data[0] &&
      data.data[0].embedding
    ) {
      return data.data[0].embedding;
    }

    return null;
  }

  // List models
  async listModels() {
    const url = "/models";

    const response = await fetch(`${this.baseUrl}${url}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      // eslint-disable-next-line no-console
      console.error("DeepSeek listModels error:", errorText);
      return [];
    }

    const data = await response.json();

    if (data && data.data && Array.isArray(data.data)) {
      return data.data.map((m) => m.id);
    }

    return [];
  }
}

// ---------------------------
// 🔓 Exports expected by App.js
// ---------------------------

// Default shared service instance
const defaultService = new DeepSeekService("CORE");

// `coreAI` – used in App.js
export const coreAI = defaultService;

// `DEEPSEEK_API` – legacy-style object used in App.js
export const DEEPSEEK_API = {
  service: defaultService,
  MODELS:
    (SYSTEM_CONFIG && SYSTEM_CONFIG.MODELS) || DEEPSEEK_MODELS,
  chat: (opts) => defaultService.chat(opts),
  embed: (text, model) => defaultService.embed(text, model),
  listModels: () => defaultService.listModels()
};

// Default export is the class (for any new uses)
export default DeepSeekService;
