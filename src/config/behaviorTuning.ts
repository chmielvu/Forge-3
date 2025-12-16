
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
    verboseLogging: false,        // NEW: Verbose console logging for media controller
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
  UNIFIED_DIRECTOR: {
    // How many prefects to simulate per turn
    ACTIVE_PREFECT_COUNT: 2, // Reduced from 3 for faster inference
    
    // Whether to use gemini-2.5-flash (fast, supports thinking) or gemini-3-pro (slower)
    // Updated: Defaulting to Flash 2.5 with Thinking for best RPM/Quality balance
    USE_PRO_MODEL: false, 
    
    // Whether to include full prefect DNA in prompt (verbose but accurate)
    INCLUDE_FULL_CONTEXT: true
  },
  TEST_MODE: false, // NEW: Flag to globally disable Web Workers for testing/restricted environments
};

export const KGOT_CONFIG = {
  DECAY: {
    RATE: 0.05, // 5% loss/turn
    MIN_WEIGHT: 0.05, // Eternal scar
    INTERVAL: 5, // Turns
    TYPES: ['GRUDGE', 'TRAUMA_BOND', 'OBSESSION']
  },
  GRAPHRAG: {
    REBUILD_THRESHOLD: 0.1, // 10% change
    SUBGRAPH_CAP: 20, // Nodes
    TTL_HOURS: 1, // Cache
    COMMUNITY_CAP: 5 // Summaries
  }
};