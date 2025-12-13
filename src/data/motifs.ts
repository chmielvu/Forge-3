/**
 * @file src/data/motifs.ts
 * @description Extendable library of visual motifs (Manara-esque and Narrative-specific).
 */

export const FORGE_MOTIFS = {
  // --- Core Manara Signatures ---
  FelineEyes: "Heavy-lidded, almond-shaped feline eyes with thick lashes and a permanent glint of amused cruelty.",
  CruelHalfSmile: "One corner of the mouth lifted in a subtle, knowing half-smile that never reaches the eyes.",
  TeasingCruelty: "Expression that promises pleasure and pain, eyebrow slightly arched, gaze locked on vulnerability.",
  LiquidStrands: "Hair rendered as individual glossy strands that catch and refract light, escaping to caress skin.",
  ImpossibleElegance: "Unnaturally long, aristocratic fingers with perfect nails.",
  LanguidDominance: "Weight shifted to one hip, shoulders relaxed, head tilted slightly down while eyes look up.",
  
  // --- Somatic / Texture Details ---
  BoundWrists: "Light silk or leather restraints on wrists, symbolizing non-consensual control without pain.",
  FlushedSkin: "Flushed, sweat-glistened skin with subtle bruises, conveying unwilling arousal.",
  TremblingHands: "Hands trembling slightly, fingers clenched in fear-tinged desire.",
  ClingingVelvet: "Velvet that clings to every curve like a second skin, folds drawn with liquid linework.",
  RimLitCleavage: "Strong rim-light traces the edge of plunging neckline and shadowed valley between breasts.",
  VelvetShadowPool: "Deep velvet shadows deliberately pooled in cleavage, under jawlines, and between parted thighs.",
  WetSilkEffect: "Fabric rendered semi-transparent with sweat or steam, clinging to skin.",
  
  // --- Action / Pose ---
  KneelingGoddess: "Woman kneeling over a victim yet looking down from above, back arched to accentuate curves.",
  VoyeurSilhouette: "Figure half in shadow, only the curve of waist, breast, and thigh outlined by rim-light.",
  LethalCaress: "Hand performing a gesture that is simultaneously tender and threatening.",
  SlitToHip: "Skirt slit to the hip bone, revealing the entire length of a sculpted leg and lace garter.",
  
  // --- Environmental ---
  WeepingStone: "Massive Roman concrete walls slick with condensation and moss, conveying ancient oppression.",
  GaslampGlare: "Hissing gas flame distortion, casting long unnatural shadows that look like claws."
};

export const ARCHETYPE_VISUAL_MAP: Record<string, { mood?: string, physique?: string, face?: string, attire?: string }> = {
    'The Zealot': { mood: "stern, judgmental, brittle", physique: "rigid posture", face: "severe, tight bun", attire: "pristine uniform, fully buttoned, no skin showing" },
    'The Yandere': { mood: "unnerving stillness, manic-pixie-nightmare", physique: "petite, delicate, deceptively weak", face: "wide doe-eyes, dark bangs, flat affect", attire: "uniform with subtle disarray, choker" },
    'The Dissident': { mood: "guarded, intense, cynical", physique: "lithe, agile, tense", face: "sharp features, fiery hair, smudged makeup", attire: "untucked blouse, blazer slung over shoulder" },
    'The Nurse': { mood: "warm, clinical, false-comfort", physique: "soft, fuller curves, maternal", face: "kind open face, flushed cheeks", attire: "white medical jacket over unbuttoned blouse" },
    'The Sadist': { mood: "cruel, kinetic, exhilarated", physique: "athletic, tense, coiled", face: "manic grin, dilated pupils", attire: "leather gloves, holding riding crop" },
    'The Perfectionist': { mood: "neurotic, precise, anxious", physique: "immaculate, stiff", face: "pinched, focused, sweat-bead", attire: "perfectly pressed uniform, measuring tape" },
    'The Voyeur': { mood: "detached, observant, hungry", physique: "unassuming, shadow-blending", face: "glasses, watchful eyes, lip-biting", attire: "hiding in oversized blazer, notebook" },
    'The Martyr': { mood: "suffering, beatific, ecstatic", physique: "gaunt, exhausted, trembling", face: "eyes rolled back, pale, tear-stained", attire: "stained or torn uniform, exposed collarbone" },
    'The Parasite': { mood: "mimetic, hollow, clingy", physique: "shadowy, leaning", face: "shifting expression, mirroring", attire: "copies nearest authority figure exactly" },
    'The Wildcard': { mood: "chaotic, manic, unpredictable", physique: "restless, twitchy", face: "wild eyes, smirk, smeared lipstick", attire: "mismatched accessories, jewelry" },
    'The Defector': { mood: "paranoid, furtive, terrified", physique: "hunched, protective", face: "darting eyes, sweat-slicked", attire: "ready to run, bag packed" },
    'The Mimic': { mood: "uncanny, blank, artificial", physique: "average, unremarkable", face: "placid mirror, unblinking", attire: "standard uniform, flawless" },
    'The Brat Princess': { mood: "haughty, entitled, bratty", physique: "curvaceous, poised, displaying assets", face: "sneer, flawless makeup, bored", attire: "floral tiara, silk ribbons, shorter skirt" },
    'The Siren': { mood: "languid, wet, heavy", physique: "slender, sinuous, arched", face: "wet-lips, heavy lids, flushed", attire: "off-shoulder gown, sea-glass jewelry, translucent fabric" },
    'The Psychologist': { mood: "analytical, cold, probing", physique: "composed, still, seated", face: "calm gaze, glasses, assessing", attire: "leather notebook, pen tucked, pristine cuffs" },
    'The Contender': { mood: "aggressive, sharp, competitive", physique: "muscular, coiled, imposing", face: "determined, scarred, clenched jaw", attire: "scuffed boots, cropped jacket, sleeves rolled" }
};

export type MotifKey = keyof typeof FORGE_MOTIFS;