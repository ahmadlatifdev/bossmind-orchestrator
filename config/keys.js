// DeepSeek API Keys - Replace with your ACTUAL keys

export const DEEPSEEK_KEYS = {
  CORE: "sk-5a46bee270d64a78b7019886b98c63e0",
  GENERATOR: "sk-fddee0bd1c774ffa9c47ce8834b5bc9b",
  REASONING: "sk-d5e9e325f82945549e73bc5b1715a38a",
  EMBEDDINGS: "sk-9f3286d012144fa080da5b5348804d",

  AUTOMATION_ENGINE: "sk-96cf46cc89924baab42a51db87105ef3",
  MISSION_PROCESSOR: "sk-1664f827a0974d09bc0706f1270a2b79"
};

// Backend API Configuration
export const BACKEND_CONFIG = {
  BASE_URL: "http://localhost:5000",
  API_VERSION: "v1",
  ENDPOINTS: {
    MISSIONS: "/api/missions",
    BOZEMSKI: "/api/bozemski",
    INTELLIGENCE: "/api/intelligence",
    SECURITY: "/api/security",
    HEALTH: "/api/health"
  }
};

// System Configuration
export const SYSTEM_CONFIG = {
  APP_NAME: "Bossmind Orchestrator",
  VERSION: "3.0.0",
  DEEPSEEK_API_VERSION: "v1",
  
  // AI Models Configuration
  MODELS: {
    DEFAULT: "deepseek-chat",
    REASONING: "deepseek-reasoner",
    CODING: "deepseek-coder"
  },
  
  // Limits
  MAX_TOKENS: 4000,
  TEMPERATURE: 0.7,
  
  // Services Configuration
  SERVICES: {
    CORE_AI: { key: "CORE", model: "deepseek-chat" },
    GENERATOR_AI: { key: "GENERATOR", model: "deepseek-chat" },
    REASONING_AI: { key: "REASONING", model: "deepseek-reasoner" },
    EMBEDDINGS_AI: { key: "EMBEDDINGS", model: "deepseek-coder" }
  }
};

// Export helper to get key for service
export function getKeyForService(serviceName) {
  return DEEPSEEK_KEYS[SYSTEM_CONFIG.SERVICES[serviceName]?.key] || DEEPSEEK_KEYS.CORE;
}

// Export helper to get model for service
export function getModelForService(serviceName) {
  return SYSTEM_CONFIG.SERVICES[serviceName]?.model || SYSTEM_CONFIG.MODELS.DEFAULT;
}

// Export all
export default {
  DEEPSEEK_KEYS,
  BACKEND_CONFIG,
  SYSTEM_CONFIG,
  getKeyForService,
  getModelForService
};