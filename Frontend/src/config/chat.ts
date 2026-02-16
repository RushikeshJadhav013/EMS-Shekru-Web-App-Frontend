// Chat Configuration
export const CHAT_CONFIG = {
  // Set to false when backend APIs are ready
  DEVELOPMENT_MODE: import.meta.env.DEV,

  // API Base URL
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://staffly.space',

  // Chat settings
  MESSAGE_LIMIT_PER_PAGE: 50,
  TYPING_INDICATOR_TIMEOUT: 3000,

  // UI settings
  EMOJI_PICKER_COLUMNS: 8,
  MAX_MESSAGE_LENGTH: 1000,

  // Mock data settings (only used in development mode)
  MOCK_API_DELAY: 500, // milliseconds

  // Feature flags
  FEATURES: {
    FILE_UPLOAD: false, // Will be implemented later
    VOICE_MESSAGES: false, // Will be implemented later
    VIDEO_CALLS: false, // Will be implemented later
    MESSAGE_REACTIONS: false, // Will be implemented later
  }
};

export default CHAT_CONFIG;