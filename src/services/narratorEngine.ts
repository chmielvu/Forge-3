
import { YandereLedger } from '../types';

export type NarratorMode = 
  | 'MOCKING_JESTER' 
  | 'SEDUCTIVE_DOMINATRIX' 
  | 'FEMINIST_ANALYST' 
  | 'SYMPATHETIC_CONFIDANTE';

export interface NarratorVoice {
  tone: string;
  exampleInterjection: string;
  choiceBias: 'subtle_mockery' | 'encourages_submission' | 'validates_pattern_recognition' | 'empathetic_fatalism';
  cssClass: string;
  voiceId: string; // Made mandatory
  borderColor: string;
  textColor: string;
}

export const NARRATOR_VOICES: Record<NarratorMode, NarratorVoice> = {
  MOCKING_JESTER: {
    tone: "sardonic, amused, slightly disappointed, like a bored god watching a play",
    exampleInterjection: "Oh, how *brave* of you. Defiance as performance art—they've seen this a thousand times.",
    choiceBias: 'subtle_mockery',
    cssClass: 'narrator-jester',
    voiceId: 'Puck', // Witty, playful
    borderColor: '#eab308', // yellow-500
    textColor: '#fde047' // yellow-300
  },
  SEDUCTIVE_DOMINATRIX: {
    tone: "sultry, conspiratorial, subtly commanding, whispering dangerous secrets",
    exampleInterjection: "Mmm, yes—see how much easier it is when you stop fighting?",
    choiceBias: 'encourages_submission',
    cssClass: 'narrator-seductress',
    voiceId: 'Kore', // Soft, whispering (mapped to best available female soft voice)
    borderColor: '#f43f5e', // rose-500
    textColor: '#fda4af' // rose-300
  },
  FEMINIST_ANALYST: {
    tone: "academic, darkly fascinated, detached, analyzing the systemic nature of the horror",
    exampleInterjection: "You're beginning to see the infrastructure, aren't you? How patriarchal dominance isn't inverted here—it's perfected.",
    choiceBias: 'validates_pattern_recognition',
    cssClass: 'narrator-analyst',
    voiceId: 'Charon', // Deep, authoritative, serious
    borderColor: '#3b82f6', // blue-500
    textColor: '#93c5fd' // blue-300
  },
  SYMPATHETIC_CONFIDANTE: {
    tone: "gentle, grieving, uncomfortably intimate, like a mourning lover",
    exampleInterjection: "I know. I know it hurts. Your only choices now are between kinds of breaking.",
    choiceBias: 'empathetic_fatalism',
    cssClass: 'narrator-confidante',
    voiceId: 'Zephyr', // Calm, balanced
    borderColor: '#a855f7', // purple-500
    textColor: '#d8b4fe' // purple-300
  }
};

/**
 * Selects narrator mode based on current ledger state
 */
export function selectNarratorMode(ledger: YandereLedger): NarratorMode {
  const { phase, traumaLevel, complianceScore, shamePainAbyssLevel, hopeLevel } = ledger;

  // Phase-based selection with nuance
  if (phase === 'alpha') {
    // Early game: mockery and cruelty
    return 'MOCKING_JESTER';
  }

  if (phase === 'beta') {
    // Mid-game: transition based on compliance
    if (complianceScore > 60) {
      return 'SEDUCTIVE_DOMINATRIX'; // Reward compliance with sultry encouragement
    }
    if (traumaLevel > 50 && shamePainAbyssLevel > 50) {
      return 'FEMINIST_ANALYST'; // Meta-commentary on the system
    }
    return 'MOCKING_JESTER'; // Default to mockery
  }

  if (phase === 'gamma') {
    // End-game: broken or enlightened
    if (traumaLevel > 70 || hopeLevel < 30) {
      return 'SYMPATHETIC_CONFIDANTE'; // False comfort in final stages
    }
    return 'FEMINIST_ANALYST'; // Academic detachment
  }

  return 'FEMINIST_ANALYST'; // Safe default
}

/**
 * Generates contextual annotations for player choices
 */
export function generateChoiceAnnotation(
  choice: { id: string; text: string; type?: string },
  narratorMode: NarratorMode,
  ledger: YandereLedger
): string {
  const voice = NARRATOR_VOICES[narratorMode];
  const choiceText = choice.text.toLowerCase();

  // Resistance detection
  const isResistance = choiceText.match(/resist|defy|refuse|fight|no|reject/i);
  const isCompliance = choiceText.match(/comply|obey|submit|yes|accept|please/i);
  const isSubversion = choiceText.match(/lie|trick|manipulate|pretend/i);

  switch (voice.choiceBias) {
    case 'subtle_mockery':
      if (isResistance) {
        const mockeries = [
          "Brave—or stupid. But you knew that, didn't you?",
          "They've broken stronger men with less. But go ahead.",
          "Defiance as performance art. How original.",
          "Your pride will look lovely next to your shattered testicles."
        ];
        return mockeries[Math.floor(Math.random() * mockeries.length)];
      }
      if (isCompliance) {
        return "Safety in surrender. For now.";
      }
      if (isSubversion) {
        return "Clever. Or do you just think you are?";
      }
      return "Interesting. Let's see where this goes.";

    case 'encourages_submission':
      if (isCompliance) {
        const encouragements = [
          "They'll be so pleased with you.",
          "Good. It's so much easier when you stop fighting.",
          "You're learning. Finally.",
          "Surrender is its own kind of freedom, isn't it?"
        ];
        return encouragements[Math.floor(Math.random() * encouragements.length)];
      }
      if (isResistance) {
        return "Still clinging to that, are we? How exhausting.";
      }
      return "Mmm. Interesting choice.";

    case 'validates_pattern_recognition':
      if (isSubversion) {
        return "You're starting to see the system. Good. Use it.";
      }
      if (isResistance && ledger.capacityForManipulation > 50) {
        return "Strategic defiance. They expect that from someone like you.";
      }
      return "Notice how the architecture shapes your options. Even now.";

    case 'empathetic_fatalism':
      if (isResistance) {
        return "I know you have to try. But we both know how this ends.";
      }
      if (isCompliance) {
        return "It's okay. There's no shame in choosing the path that hurts less.";
      }
      return "Whatever you choose, I'll be here. Watching. Grieving.";

    default:
      return "";
  }
}

/**
 * Generates scene interjections for dramatic moments
 */
export function generateInterjection(
  eventType: 'trauma_spike' | 'betrayal' | 'comfort' | 'discovery' | 'pre_choice',
  narratorMode: NarratorMode,
  context?: { traumaLevel?: number; character?: string; action?: string }
): string {
  // const voice = NARRATOR_VOICES[narratorMode];

  const interjections: Record<NarratorMode, Record<string, string[]>> = {
    MOCKING_JESTER: {
      trauma_spike: [
        "(That sound you just made? They *live* for that.)",
        "(Breaking news: your balls still hurt. Shocking.)",
        "(Ten points for the scream. Minus five for the tears.)"
      ],
      betrayal: [
        "(Surprised? You shouldn't be. They always do this.)",
        "(Trust is so *quaint* here, isn't it?)"
      ],
      comfort: [
        "(Ah yes, the 'good cop.' As if that's not part of the script.)",
        "(She's so good at this. You almost believe she cares.)"
      ],
      discovery: [
        "(Congratulations. You've discovered the obvious.)",
        "(Welcome to the pattern. Took you long enough.)"
      ],
      pre_choice: [
        "(Choose carefully. Or don't. They win either way.)"
      ]
    },
    SEDUCTIVE_DOMINATRIX: {
      trauma_spike: [
        "(Shhh. Let it wash over you. The pain is proof you're still alive.)",
        "(That's it. Feel how powerless you are. Doesn't it make you ache?)"
      ],
      betrayal: [
        "(Did you really think they meant it? How deliciously naive.)"
      ],
      comfort: [
        "(See how good submission feels when they reward it?)",
        "(You want this. The relief. The approval. Admit it.)"
      ],
      pre_choice: [
        "(What will please them most? That's all that matters now.)"
      ],
      discovery: [
        "(You see it now, don't you?)"
      ]
    },
    FEMINIST_ANALYST: {
      trauma_spike: [
        "(Notice the somatic cascade. Axiom 3 in action: the groin as psychological anchor.)",
        "(Your body just testified against you. Trauma as involuntary confession.)"
      ],
      betrayal: [
        "(The trauma bond tightens. Betrayal followed by comfort—textbook Calista.)",
        "(She used your secrets exactly as predicted. The system is elegant, isn't it?)"
      ],
      comfort: [
        "(Observe: 'care' as management tool. Classic Hurt/Comfort architecture.)",
        "(She positions herself as savior from pain *she helped inflict*. You're watching it happen *to you*.)"
      ],
      discovery: [
        "(You're beginning to see the infrastructure. How power doesn't invert here—it perfects itself.)",
        "(The Forge isn't chaos. It's a *curriculum*. And you're passing.)"
      ],
      pre_choice: [
        "(Your options are framed by their architecture. Even rebellion is scripted.)"
      ]
    },
    SYMPATHETIC_CONFIDANTE: {
      trauma_spike: [
        "(I'm sorry. I know it's unbearable. But you'll survive this too.)",
        "(Breathe. Just breathe. The pain will ebb. It always does.)"
      ],
      betrayal: [
        "(I know. She promised, and now... I'm sorry. I wish I could fix this.)",
        "(You trusted her. Of course you did. That's not weakness—it's human.)"
      ],
      comfort: [
        "(Let her hold you. You need this, even if it's contaminated.)",
        "(Take the solace while it's offered. Tomorrow is soon enough for truth.)"
      ],
      discovery: [
        "(You're so strong to have seen through it. But knowing doesn't make it hurt less.)",
        "(Yes. Now you understand. And understanding is its own kind of scar.)"
      ],
      pre_choice: [
        "(Whatever you choose, I'll be here. There are no good options now—only different kinds of breaking.)"
      ]
    }
  };

  const modeInterjections = interjections[narratorMode]?.[eventType] || [];
  if (modeInterjections.length === 0) return "";

  return modeInterjections[Math.floor(Math.random() * modeInterjections.length)];
}

export function injectNarratorCommentary(
  narrative: string,
  mode: NarratorMode,
  context?: any
): string {
  // Detect key moments based on basic keyword heuristics
  const hasTraumaEvent = /struck|pain|agony|scream/i.test(narrative);
  const hasComfort = /gentle|soft|caress|sooth/i.test(narrative);
  const hasBetrayal = /lie|trick|deceive|fool/i.test(narrative);
  
  let enhanced = narrative;
  
  if (hasTraumaEvent) {
    const interjection = generateInterjection('trauma_spike', mode, context);
    // Append the interjection if found
    if (interjection) enhanced = `${enhanced}\n\n${interjection}`;
  } else if (hasBetrayal) {
     const interjection = generateInterjection('betrayal', mode, context);
     if (interjection) enhanced = `${enhanced}\n\n${interjection}`;
  } else if (hasComfort) {
    const interjection = generateInterjection('comfort', mode, context);
    if (interjection) enhanced = `${enhanced}\n\n${interjection}`;
  }
  
  return enhanced;
}
