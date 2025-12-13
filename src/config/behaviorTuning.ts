
// Central configuration for tuning agent and game loop behavior
export const BEHAVIOR_CONFIG = {
  PREFECT_SPOTLIGHT_COUNT: 4,
  TRAUMA_THRESHOLDS: {
    HIGH: 80,
    CRITICAL: 90,
    SHAKE_START: 50,
    GLITCH_START: 70
  },
  ANIMATION: {
    ENABLE_VEO: true, // Set to false to disable video generation (save tokens)
    ENABLE_TTS: true,
    ENABLE_HAPTICS: true
  },
  DEV_MODE: {
    ENABLED: true,
    TRIGGER_KEY: '`', // Tilde key
    LOG_ACTIONS: true,
    skipMediaGeneration: false,  // NEW: Skip all media for fast iteration
    verboseLogging: true,        // NEW: Verbose console logging for media controller
  },
  GAMEPLAY: {
    TURN_DELAY_MS: 1500, // Artificial delay for "thinking" feel
    HISTORY_WINDOW_SIZE: 15
  },
  // NEW: Media generation thresholds and settings
  MEDIA_THRESHOLDS: {
    enableVideoAboveTrauma: 80, // Trauma level to enable video generation
    enableVideoAboveShame: 80,  // Shame level to enable video generation
    enableAudio: true,          // Globally enable/disable audio generation
    enableImages: true,         // Globally enable/disable image generation
    enableVideo: false,         // Globally enable/disable video generation (for non-thresholded scenes)
    MAX_MEDIA_QUEUE_RETRIES: 3, // Max retries for failed media generation
  },
};