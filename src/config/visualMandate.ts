/**
 * @file src/config/visualMandate.ts
 * @description The immutable aesthetic constitution for The Forge's Loom.
 * Defines the "Baroque Brutalism + Vampire Noir" style lock.
 */

export const VISUAL_MANDATE = {
  // The immutable header injected into every image prompt
  ZERO_DRIFT_HEADER: "((MASTER STYLE LOCK)): Milo Manara style (clean ink lines, fluid contours, impossible elegance, feline eyes, cruel half-smile, teasing cruelty, liquid strands, languid dominance), high-contrast Neo-Noir, erotic dark academia, Eroticized Distress, Systemic Emasculation, Bored God Complex. Art by Milo Manara, J. Scott Campbell, Artgerm, Greg Rutkowski, Frank Frazetta for high-fidelity erotic realism. Clinical line, unforgiving precision, negative space isolation, wet surfaces, Art Deco geometry, smoke haze, clinical chiaroscuro, venetian blind shadows, Yves Saint Laurent tailoring, NO TEXT/WATERMARKS, NO GRADIENTS, NO CROSS-HATCHING, NO MUDDY TEXTURES.",

  // Core aesthetic definitions
  STYLE: "Erotic Dark Academia + Neo-Noir + Milo Manara synthesis. Clean lines, high-fashion brutality, dreamlike eroticism, atmospheric density. From search: photorealistic painting, very short skirt, passionate kiss, heavy-lidded eyes, glossy strands.",
  
  TECHNICAL: {
    camera: "intimate 50mm or 85mm close-up, shallow depth of field, bokeh background",
    lighting: "single flickering gaslight or cold surgical lamp, deep shadows pooling in cleavage and skirt slits, volumetric fog, rim lighting on sweat/skin, subtle bruises visible.",
    resolution: "4K ultra-detailed"
  },

  MOOD: "predatory intimacy, clinical amusement, suffocating desire, weaponized sexuality, voyeuristic, non-consensual fear, unwilling arousal, languid dominance.",

  // Strict negative prompt to prevent style drift
  NEGATIVE_PROMPT: "oil painting texture, Renaissance Brutalism, gothic decay, warm candlelight, heavy robes, feral hair, dusty motes, fungal bloom, ancient stone, gradients, cross-hatching, pixel-dense textures",
  
  RESOLUTION: "1024x1024"
} as const;

export const VIDEO_MANDATE = {
  STYLE: "Cinematic slow motion, psychological horror, atmospheric.",
  DIRECTIVES: "Micro-movements of breathing and fabric. Flickering light. Dust motes. No morphing. Maintain Manara-Noir aesthetic.",
  RESOLUTION: "720p"
} as const;

export const LIGHTING_PRESETS = {
  'Harsh': "Lighting: Single dominant harsh source (top-down clinical surgical lamp) with strong cool rim-light. Shadows emphasize bruises. Sweat glistens on tense skin.",
  'Intimate': "Lighting: Warm gaslamp amber glow battling cool blue moonlight. Deep chiaroscuro. Light catches the edges of lace and restrained limbs. Shadows pool in hollows. Dominant colors: #991b1b, #1e1b2d, #a8a29e.", // Burgundy, navy, muted gold
  'Moody': "Lighting: Cinematic rim lighting only. Silhouette emphasis against volumetric fog. Eyes reflecting the single light source with unwilling desire. Dominant colors: #064e3b, #7f1d1d, #0c0a09.", // Emerald, burgundy, deepest black
  'WarmCandle': "Lighting: Flickering candle flame from side, casting warm oranges with deep black shadows. Inspired by tavern intimacy, but with restrained tension. Dominant colors: #7f1d1d, #1c1917, #a8a29e.", // Burgundy, dark charcoal, muted gold
  'Clinical': "Lighting: Harsh fluorescent overhead, cold sterile white, sharp clinical shadows, antiseptic atmosphere. Dominant colors: #1e1b2d, #065f46, #e7e5e4." // Navy, emerald, muted white
} as const;

export type LightingKey = keyof typeof LIGHTING_PRESETS;