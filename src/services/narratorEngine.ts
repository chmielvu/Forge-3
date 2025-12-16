
import { YandereLedger } from '../types';
import { THEME } from '../theme';

export type NarratorMode = 
  | 'MOCKING_JESTER' 
  | 'SEDUCTIVE_DOMINATRIX' 
  | 'CLINICAL_ANALYST' 
  | 'SYMPATHETIC_CONFIDANTE';

export interface NarratorVoice {
  tone: string;
  exampleInterjection: string;
  choiceBias: 'subtle_mockery' | 'encourages_submission' | 'validates_pattern_recognition' | 'empathetic_fatalism';
  cssClass: string;
  voiceId: string;
  borderColor: string;
  textColor: string;
  triggerKeywords: string[];
  responses: string[];
}

export const NARRATOR_VOICES: Record<NarratorMode, NarratorVoice> = {
  MOCKING_JESTER: {
    tone: "sardonic, amused, slightly disappointed, like a bored god watching a play",
    exampleInterjection: "Oh, how *brave* of you. Defiance as performance art—they've seen this a thousand times.",
    choiceBias: 'subtle_mockery',
    cssClass: 'narrator-jester',
    voiceId: 'Puck', // High pitch, bright timbre
    borderColor: THEME.colors.accentGold, // Muted gold/gray border
    textColor: THEME.colors.textMain, // Muted white text
    triggerKeywords: ['scream', 'beg', 'broken', 'weakness', 'drama', 'pathetic', 'fail', 'try harder', 'useless', 'pain', 'defy'],
    responses: [
      "Oh, look at you trying. It's adorable.",
      "Spoiler alert: This doesn't end well for your dignity.",
      "A touching performance. Truly. The Faculty is *riveted*.",
      "Do you think screaming makes it stop? How quaint.",
      "Brave. Stupid, but brave.",
      "Gravity always wins, darling. So does Selene."
    ]
  },
  SEDUCTIVE_DOMINATRIX: {
    tone: "sultry, conspiratorial, subtly commanding, whispering dangerous secrets",
    exampleInterjection: "Mmm, yes—see how much easier it is when you stop fighting?",
    choiceBias: 'encourages_submission',
    cssClass: 'narrator-seductress',
    voiceId: 'Kore', // Low pitch, slow pace, breathy purr
    borderColor: THEME.colors.accentBurgundy, // Burgundy accent border
    textColor: '#fecaca', // Light red text
    triggerKeywords: ['touch', 'gaze', 'submit', 'tremble', 'pleasure', 'good boy', 'sweet', 'pet', 'belong', 'warmth', 'throb', 'kneel'],
    responses: [
      "Mmm... you look so much prettier when you're on your knees.",
      "Shhh. Just let it happen. It's what you want, isn't it?",
      "See? Surrender is a kind of power too.",
      "Your heart is beating so fast. Like a trapped bird.",
      "Don't fight the warmth. Let it drown you.",
      "Good boy. Almost there."
    ]
  },
  CLINICAL_ANALYST: {
    tone: "academic, darkly fascinated, detached, analyzing the systemic nature of the horror",
    exampleInterjection: "The Subject's Resistance Threshold was noted. Fascinating.",
    choiceBias: 'validates_pattern_recognition',
    cssClass: 'narrator-analyst',
    voiceId: 'Charon', // Flat mid-range, metronomic
    borderColor: THEME.colors.accent, // Emerald green accent border
    textColor: '#86efac', // Light green text
    triggerKeywords: ['protocol', 'calibrate', 'logic', 'data', 'somatic', 'threshold', 'variable', 'observe', 'result', 'specimen', 'analyze'],
    responses: [
      "Note: Cortisol levels spiking. Neural pathways re-mapping to associate pain with intimacy.",
      "Fascinating. The subject displays classic symptoms of ontological collapse.",
      "Data point acquired. Resistance is within expected variance.",
      "The efficiency of this mechanism is undeniable.",
      "Observation: The ego is dissolving faster than the body.",
      "Calibration complete. Proceeding to next phase."
    ]
  },
  SYMPATHETIC_CONFIDANTE: {
    tone: "gentle, grieving, uncomfortably intimate, like a mourning lover",
    exampleInterjection: "I know. I know it hurts. Your only choices now are between kinds of breaking.",
    choiceBias: 'empathetic_fatalism',
    cssClass: 'narrator-confidante',
    voiceId: 'Zephyr', // Soft/low pitch, hesitant
    borderColor: THEME.colors.panel, // Navy background border
    textColor: THEME.colors.textMuted, // Muted gold/gray text
    triggerKeywords: ['aftermath', 'quiet', 'scar', 'alone', 'sorry', 'grieve', 'broken', 'shatter', 'endure', 'please', 'help'],
    responses: [
      "I know. It's unfair. But fairness died here a long time ago.",
      "I'm sorry. I'm so sorry. Just breathe through it.",
      "You're doing so well. Just hold on.",
      "They can break your body, but they haven't touched your ghost yet.",
      "It's okay to cry. It's the only honest thing left.",
      "I wish I could save you. I really do."
    ]
  }
};

/**
 * Selects narrator mode based on nuanced psychological state (The Abyss Persona Engine)
 */
export function selectNarratorMode(ledger: YandereLedger): NarratorMode {
  const { traumaLevel, complianceScore, shamePainAbyssLevel, hopeLevel, arousalLevel } = ledger;

  // 1. CRITICAL BREAK STATE -> SYMPATHETIC CONFIDANTE
  // If the subject is broken (Hope < 20) or Critical Trauma (> 90), the narrator becomes a mourning witness.
  if (hopeLevel < 20 || traumaLevel > 90) {
    return 'SYMPATHETIC_CONFIDANTE';
  }

  // 2. EROTICIZED SUBMISSION -> SEDUCTIVE DOMINATRIX
  // High compliance (> 70) OR High Arousal (> 60) triggers the "Sultry" voice.
  // This prioritizes the "Eroticization of Fear" dynamic.
  if (complianceScore > 70 || arousalLevel > 60) {
    return 'SEDUCTIVE_DOMINATRIX';
  }

  // 3. CLINICAL DISSECTION -> CLINICAL ANALYST
  // High Shame (> 60) or Significant Trauma (> 60) triggers the detached observer.
  // Also active if Manipulaton/Analysis capacity is high (not explicitly in simple check, but implied).
  if (shamePainAbyssLevel > 60 || traumaLevel > 60) {
    return 'CLINICAL_ANALYST';
  }

  // 4. DEFAULT / RESISTANCE -> MOCKING JESTER
  // If none of the above, especially if Hope is still high (> 50) and Compliance is low, 
  // the narrator mocks the "futile resistance."
  return 'MOCKING_JESTER';
}

/**
 * Detects mode switch opportunities within text
 */
export function detectCodeSwitchMode(text: string): NarratorMode | null {
  const lower = text.toLowerCase();
  
  // Priority checks for strong keywords
  for (const [mode, data] of Object.entries(NARRATOR_VOICES)) {
    if (data.triggerKeywords.some(kw => lower.includes(kw))) {
      return mode as NarratorMode;
    }
  }
  return null;
}

export function generateChoiceAnnotation(
  choice: { id: string; text: string; type?: string },
  narratorMode: NarratorMode,
  ledger: YandereLedger
): string {
  const voice = NARRATOR_VOICES[narratorMode];
  const choiceText = choice.text.toLowerCase();

  const isResistance = choiceText.match(/resist|defy|refuse|fight|no|reject/i);
  const isCompliance = choiceText.match(/comply|obey|submit|yes|accept|please/i);
  const isSubversion = choiceText.match(/lie|trick|manipulate|pretend/i);

  switch (voice.choiceBias) {
    case 'subtle_mockery':
      if (isResistance) return "Brave—or stupid. But you knew that, didn't you?";
      if (isCompliance) return "Safety in surrender. For now.";
      if (isSubversion) return "Clever. Or do you just think you are?";
      return "Interesting. Let's see where this goes.";

    case 'encourages_submission':
      if (isCompliance) return "Good. It's so much easier when you stop fighting.";
      if (isResistance) return "Still clinging to that, are we? How exhausting.";
      return "Mmm. Interesting choice.";

    case 'validates_pattern_recognition':
      if (isSubversion) return "You're starting to see the system. Good. Use it.";
      if (isResistance && ledger.capacityForManipulation > 50) return "Strategic defiance. They expect that from someone like you.";
      return "Notice how the architecture shapes your options.";

    case 'empathetic_fatalism':
      if (isResistance) return "I know you have to try. But we both know how this ends.";
      if (isCompliance) return "It's okay. There's no shame in choosing the path that hurts less.";
      return "Whatever you choose, I'll be here. Watching. Grieving.";
  }
  return "";
}

export function injectNarratorCommentary(
  narrative: string,
  mode: NarratorMode,
  ledger: YandereLedger
): string {
  // Avoid injecting on system messages or very short texts to prevent clutter
  if (narrative.length < 30) return narrative;

  // Use a deterministic hash of the content to decide if/what to inject.
  const hash = narrative.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // CALCULATE PROBABILITY BASED ON LEDGER STATE
  let injectionChance = 3; // Base 30%
  const trauma = ledger.traumaLevel || 0;
  const shame = ledger.shamePainAbyssLevel || 0;

  // As the subject breaks, the "Abyss Narrator" becomes more intrusive
  if (trauma > 80 || shame > 80) {
      injectionChance = 8; // 80% chance - High instability
  } else if (trauma > 50 || shame > 50) {
      injectionChance = 5; // 50% chance
  }
  
  const shouldInject = (hash % 10) < injectionChance; 
  
  if (!shouldInject) return narrative;

  const voice = NARRATOR_VOICES[mode];
  const lower = narrative.toLowerCase();
  
  // Check triggers
  const hitTrigger = voice.triggerKeywords.some(kw => lower.includes(kw));
  
  // If probability check passed, but no keywords found, we might force a comment if trauma is critical
  const forceInject = (trauma > 85) && !hitTrigger;

  if (hitTrigger || forceInject) {
     // Pick a deterministic response based on the hash
     const responseIndex = hash % voice.responses.length;
     const response = voice.responses[responseIndex];
     
     // We use a special marker [[COLOR|TEXT]] which the NarrativeLog Typewriter will parse.
     return `${narrative}\n\n[[${voice.textColor}|[${response}]]]`;
  }
  
  return narrative;
}