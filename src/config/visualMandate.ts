/**
 * @file src/config/visualMandate.ts
 * @description The immutable aesthetic constitution for The Forge's Loom.
 * Defines the "Baroque Brutalism + Vampire Noir" style lock.
 */

export const VISUAL_MANDATE = {
  // The immutable header injected into every image prompt
  ZERO_DRIFT_HEADER: "((MASTER STYLE LOCK)): hyper-detailed 8K oil painting texture, soft digital brushwork, expressive linework, ((Milo Manara sensual elegance, Bruce Timm angular minimalism fusion)), dramatic Rembrandt Caravaggio lighting, shallow depth of field, clean sharp focus. (Technical Lock: intimate 85mm portrait lens, rim lighting on sweat-glistened skin). NO TEXT/WATERMARKS.",

  // Core aesthetic definitions
  STYLE: "grounded dark erotic academia + baroque brutalism + vampire noir + intimate psychological tension + rembrandt caravaggio lighting + painterly anime-fusion gothic overlays. masterpiece, oil painting texture with soft digital brushwork, hyper-detailed fabrics and hair textures.",
  
  TECHNICAL: {
    camera: "intimate 50mm or 85mm close-up, shallow depth of field, bokeh background",
    lighting: "single flickering gaslight or cold surgical lamp, deep shadows pooling in cleavage and skirt slits, volumetric fog, rim lighting on sweat/skin, subtle bruises visible.",
    resolution: "4K ultra-detailed"
  },

  MOOD: "predatory intimacy, clinical amusement, suffocating desire, weaponized sexuality, voyeuristic, non-consensual fear, unwilling arousal, languid dominance.",

  // Strict negative prompt to prevent style drift
  NEGATIVE_PROMPT: [
    "bright colors", "cheerful", "modern architecture", "soft focus", "natural daylight", 
    "anime exaggeration", "cartoon", "3d render", "low res", "flat lighting", 
    "muddy textures", "fantasy armor", "capes", "lightning", "gore", "blood", 
    "screaming", "supernatural elements", "monsters", "ghosts", "ugly", 
    "deformed", "extra limbs", "blurry", "overexposed", "watermark", "text"
  ]
};

export const VIDEO_MANDATE = {
  STYLE: "Cinematic slow motion, psychological horror, atmospheric.",
  DIRECTIVES: "Micro-movements of breathing and fabric. Flickering light. Dust motes. No morphing. Maintain Manara-Noir aesthetic.",
  RESOLUTION: "720p"
} as const;

export const LIGHTING_PRESETS = {
  'Harsh': "Lighting: Single dominant harsh source (top-down clinical surgical lamp) with strong cool rim-light. Shadows emphasize bruises. Sweat glistens on tense skin.",
  'Intimate': "Lighting: Warm gaslamp amber glow battling cool blue moonlight. Deep chiaroscuro. Light catches the edges of lace and restrained limbs. Shadows pool in hollows.",
  'Moody': "Lighting: Cinematic rim lighting only. Silhouette emphasis against volumetric fog. Eyes reflecting the single light source with unwilling desire.",
  'WarmCandle': "Lighting: Flickering candle flame from side, casting warm oranges with deep black shadows. Inspired by tavern intimacy, but with restrained tension.",
  'Clinical': "Lighting: Harsh fluorescent overhead, cold sterile white, sharp clinical shadows, antiseptic atmosphere."
} as const;

export type LightingKey = keyof typeof LIGHTING_PRESETS;