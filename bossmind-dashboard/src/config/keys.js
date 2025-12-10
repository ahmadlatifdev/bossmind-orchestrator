// src/config/keys.js

// 🔑 DeepSeek API Keys
// Leave empty for now – real keys will be loaded from .env
export const DEEPSEEK_KEYS = {
  CORE: process.env.REACT_APP_DEEPSEEK_CORE_KEY || '',
  MISSION: process.env.REACT_APP_DEEPSEEK_MISSION_KEY || '',
  FALLBACK: process.env.REACT_APP_DEEPSEEK_FALLBACK_KEY || '',
};

// 🧠 System & Backend Configuration
export const SYSTEM_CONFIG = {
  ENV: process.env.NODE_ENV || 'development',

  BACKEND: {
    BASE_URL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000',
    HEALTH_ENDPOINT: '/api/health',
    DEEPSEEK_STATUS_ENDPOINT: '/api/deepseek/status',
    MISSIONS_ENDPOINT: '/api/missions',
  },

  DEEPSEEK_API_VERSION: 'v1',

  MODELS: {
    DEFAULT: 'deepseek-chat',
    CODER: 'deepseek-coder',
    REASONER: 'deepseek-reasoner',
  },
};

// Optional UI Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_MISSIONS_PANEL: true,
  ENABLE_SETTINGS_PANEL: true,
  ENABLE_DEEPSEEK_TEST: true,
};
