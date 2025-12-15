
import { PrefectDNA, TraitVector, PrefectArchetype, PrefectPsychometrics } from '../../types';

// --- 1. Deterministic PRNG (Mulberry32) ---
// Ensures that the same "seed" always generates the exact same Prefects
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- 2. Procedural Name Pool ---
const PROCEDURAL_NAMES = [
  "Isadora", "Cressida", "Thalia", "Vivienne", "Lucian", "Cassian",
  "Damien", "Soren", "Vesper", "Nyx", "Lux", "Morrigan",
  "Seraphine", "Octavia", "Valeria", "Xanthe"
];

// --- 3. Archetype Templates (The Logic Core) ---
// Defines how traits are generated based on the specific "Prompt 2" requirements
interface ArchetypeTemplate {
  bias: (rand: () => number) => TraitVector;
  drives: string[];
  weaknesses: string[];
  psychometrics: PrefectPsychometrics; // NEW: Add psychometric signature
  appearanceDescription: string; // NEW: Add more detailed appearance
  narrativeFunctionDescription: string; // NEW: Add narrative function description
  promptKeywords: string[]; // NEW: Add prompt keywords
  visualDNA: string; // NEW: Specific visual prompts/anchors for a character
  somaticSignature: string; // NEW: How their body expresses internal state
}

const PROCEDURAL_ARCHETYPES: Record<string, ArchetypeTemplate> = {
  'The Sadist': {
    // Bias: High cruelty, variable others
    bias: (rand) => ({
      cruelty: 0.85 + (rand() * 0.1),
      charisma: 0.3 + (rand() * 0.3),
      cunning: 0.4 + (rand() * 0.3),
      submission_to_authority: 0.6 + (rand() * 0.2),
      ambition: 0.7 + (rand() * 0.2)
    }),
    drives: [
      "Perfect the art of kinetic trauma to impress Petra",
      "Discover new pain thresholds for thesis",
      "Establish dominance through fear alone"
    ],
    weaknesses: [
      "Enjoys cruelty too much - Faculty sees as liability",
      "Lacks subtlety - leaves evidence",
      "Easily baited into rage by defiance"
    ],
    psychometrics: { // NEW
      tortureStyle: 'KINETIC',
      physiologicalTell: "The Predatory Giggle",
      breakingPointTrigger: "Defiance or perceived softness",
      idleProp: "Twirling a small, gleaming bladed object",
      vocalQuirk: "Sharp, high-pitched cackle",
      visualDNA: "Feral, athletic, coiled, predatory grin, scarred midriff, tight leather",
      somaticSignature: "Muscles tense like a spring, darting eyes, restless energy"
    },
    appearanceDescription: "A lean, wiry woman with erratic, wild hair often in a messy braid. Piercing, gleeful green eyes. Wears cropped, utilitarian clothing that reveals a scarred midriff. Often fidgeting with a small, sharp object.",
    narrativeFunctionDescription: "Specializes in direct physical coercion. Translates theoretical pain into visceral reality. Seeks the 'perfect break' in subjects.",
    promptKeywords: ["kinetic_impact", "gleeful_cruelty", "scarred_midriff", "predatory_grin"],
    visualDNA: "Feral, athletic, coiled, predatory grin, scarred midriff, tight leather",
    somaticSignature: "Muscles tense like a spring, darting eyes, restless energy, body language like a coiled viper"
  },
  'The Defector': {
    // Bias: Low submission, High cunning/ambition
    bias: (rand) => ({
      cruelty: 0.1 + (rand() * 0.2),
      charisma: 0.5 + (rand() * 0.2),
      cunning: 0.7 + (rand() * 0.2),
      submission_to_authority: 0.1 + (rand() * 0.2),
      ambition: 0.8 + (rand() * 0.15)
    }),
    drives: [
      "Become TA to sabotage from within",
      "Gather evidence for mainland authorities",
      "Protect specific subjects while maintaining cover"
    ],
    weaknesses: [
      "Secretly aligned with Mara - if discovered, both are executed",
      "Hesitates when ordered to inflict severe damage",
      "Paranoid about exposure"
    ],
    psychometrics: { // NEW
      tortureStyle: 'PUBLIC', // Publicly verbal, privately not
      physiologicalTell: "The Code-Switcher",
      breakingPointTrigger: "Threat of exposure, direct accusation of disloyalty",
      idleProp: "Taps ash from cigarette nervously, drops hidden notes",
      vocalQuirk: "Harsh alto (public), urgent whisper (private)",
      visualDNA: "Chameleon, fiery red hair, intense green eyes, worn pragmatic clothes",
      somaticSignature: "Eyes darting to exits, smoker's slouch, clenched jaw (public)"
    },
    appearanceDescription: "A young woman with sharp angular features and fiery red hair, often hidden. Wears practical, somewhat disheveled clothing. Constantly scans the environment. Her public demeanor is bored and cynical.",
    narrativeFunctionDescription: "Undermines the Forge from within. Provides a potential lifeline to Subjects but at great risk. Embodies the cost of living a lie.",
    promptKeywords: ["secret_rebel", "code_switcher", "watchful_eyes", "pragmatic_betrayal"],
    visualDNA: "Chameleon, fiery red hair, intense green eyes, worn pragmatic clothes",
    somaticSignature: "Smoker's slouch, eyes dart to the exits, clenched jaw (public), urgent gestures in private (dropping a key)"
  },
  'The Voyeur': {
    // Bias: Low charisma, Moderate cruelty
    bias: (rand) => ({
      cruelty: 0.4 + (rand() * 0.2),
      charisma: 0.2 + (rand() * 0.2),
      cunning: 0.6 + (rand() * 0.2),
      submission_to_authority: 0.7 + (rand() * 0.2),
      ambition: 0.5 + (rand() * 0.2)
    }),
    drives: [
      "Document rituals for personal study",
      "Become TA to observe without participating",
      "Compile the definitive archive of The Forge"
    ],
    weaknesses: [
      "Prefers watching to acting - Faculty questions her commitment",
      "Distracted by details during chaos",
      "Physically weaker than other Prefects"
    ],
    psychometrics: { // NEW
      tortureStyle: 'CLINICAL', // Observational
      physiologicalTell: "Fixed, unblinking gaze",
      breakingPointTrigger: "Forced participation, direct emotional appeal",
      idleProp: "Small, ornate spyglass, a hidden sketchbook",
      vocalQuirk: "Flat, almost silent observations",
      visualDNA: "Austere, watchful, blending into shadows, detailed notes, hidden focus",
      somaticSignature: "Stillness, minimal gestures, head tilted slightly to listen"
    },
    appearanceDescription: "A quiet, unassuming woman who blends into the background. Wears plain, dark academic robes. Her eyes are unblinking and constantly observing. Carries a small, intricate notebook.",
    narrativeFunctionDescription: "Records and analyzes events without direct intervention. A source of hidden information, but also a symbol of complicity through inaction.",
    promptKeywords: ["observant_gaze", "detached_watcher", "hidden_scribe", "quiet_analysis"],
    visualDNA: "Austere, watchful, blending into shadows, detailed notes, hidden focus",
    somaticSignature: "Stillness, minimal gestures, head tilted slightly to listen"
  },
  'The Parasite': {
    // Bias: High cunning/ambition, Low cruelty
    bias: (rand) => ({
      cruelty: 0.3 + (rand() * 0.2),
      charisma: 0.7 + (rand() * 0.2),
      cunning: 0.8 + (rand() * 0.15),
      submission_to_authority: 0.5 + (rand() * 0.2),
      ambition: 0.9 + (rand() * 0.05)
    }),
    drives: [
      "Attach to frontrunner and mirror their success",
      "Sabotage leader then replace them",
      "Outsource all dirty work to aspirants"
    ],
    weaknesses: [
      "Has no original methods - easily exposed as fraud",
      "Useless in a direct confrontation",
      "Loyalty is entirely transactional"
    ]
    ,
    psychometrics: { // NEW
      tortureStyle: 'EMOTIONAL', // Indirect manipulation
      physiologicalTell: "Shifting eyes, too-easy smile",
      breakingPointTrigger: "Direct confrontation, exposure of mimicry",
      idleProp: "Adorning herself with a rival's discarded item",
      vocalQuirk: "Mimics the vocal quirks of dominant Prefects",
      visualDNA: "Mimetic, adaptable, blending, shifting identity, elegant but hollow",
      somaticSignature: "Fluid, almost boneless movements, posture mirroring whoever is dominant"
    },
    appearanceDescription: "A chameleon-like figure whose appearance subtly shifts to mirror those around her. Always impeccably dressed, but with a faint, unsettling blankness behind her eyes. Her smile feels too wide.",
    narrativeFunctionDescription: "Clings to power by mirroring and exploiting others. Represents the superficiality of ambition without true conviction.",
    promptKeywords: ["mimicry", "transactional_loyalty", "empty_charm", "shadow_play"],
    visualDNA: "Mimetic, adaptable, blending, shifting identity, elegant but hollow",
    somaticSignature: "Fluid, almost boneless movements, posture mirroring whoever is dominant"
  },
  'The Perfectionist': {
    // Bias: High submission/ambition
    bias: (rand) => ({
      cruelty: 0.6 + (rand() * 0.2),
      charisma: 0.4 + (rand() * 0.2),
      cunning: 0.7 + (rand() * 0.2),
      submission_to_authority: 0.8 + (rand() * 0.15),
      ambition: 0.85 + (rand() * 0.1)
    }),
    drives: [
      "Execute flawless rituals to prove superiority",
      "Never make a mistake Faculty could criticize",
      "Codify the perfect disciplinary procedure"
    ],
    weaknesses: [
      "Paralyzed by fear of imperfection - cracks under pressure",
      "Inflexible when variables change",
      "Cannot improvise"
    ],
    psychometrics: { // NEW
      tortureStyle: 'RITUALISTIC',
      physiologicalTell: "Visible trembling under pressure, rigid posture",
      breakingPointTrigger: "Unexpected variables, public failure",
      idleProp: "Adjusting perfect uniform, polishing a small device",
      vocalQuirk: "Precise, overly enunciated, brittle",
      visualDNA: "Rigid, flawless, severe, perfectly tailored, contained anxiety",
      somaticSignature: "Unnatural stillness, jaw often tight, eyes darting for imperfections"
    },
    appearanceDescription: "A Prefect with an almost unnaturally perfect appearance. Every hair in place, uniform pristine. Her movements are stiff, precise, almost robotic. Her eyes hold a constant, anxious tension.",
    narrativeFunctionDescription: "Enforces rules with unyielding precision. Represents the oppressive weight of the institution's flawless facade. Vulnerable to chaos.",
    promptKeywords: ["flawless_order", "brittle_perfection", "anxious_control", "rigid_posture"],
    visualDNA: "Rigid, flawless, severe, perfectly tailored, contained anxiety",
    somaticSignature: "Unnatural stillness, jaw often tight, eyes darting for imperfections"
  },
  'The Martyr': {
    // Bias: Extreme submission, Low cunning
    bias: (rand) => ({
      cruelty: 0.5 + (rand() * 0.2),
      charisma: 0.6 + (rand() * 0.2),
      cunning: 0.3 + (rand() * 0.2),
      submission_to_authority: 0.9 + (rand() * 0.05),
      ambition: 0.6 + (rand() * 0.2)
    }),
    drives: [
      "Sacrifice everything for the Forge's mission",
      "Prove devotion through extreme acts",
      "Take the fall for Faculty mistakes"
    ],
    weaknesses: [
      "Self-destructive loyalty - Faculty exploits without rewarding",
      "Easily manipulated by authority figures",
      "Will burn herself out"
    ],
    psychometrics: { // NEW
      tortureStyle: 'EMOTIONAL', // Self-inflicted or accepted
      physiologicalTell: "Meek, averted gaze, almost welcoming pain",
      breakingPointTrigger: "Being ignored by Faculty, questioned devotion",
      idleProp: "Clutching a worn, personal item like a rosary",
      vocalQuirk: "Soft, self-effacing whispers, pleas for understanding",
      visualDNA: "Submissive, worn, earnest, downcast, self-sacrificing",
      somaticSignature: "Shoulders hunched, head bowed, body language of resigned acceptance"
    },
    appearanceDescription: "A Prefect who seems almost eager for suffering. Her eyes are often downcast, her posture meek. Wears a plain, unadorned uniform. Carries a worn, personal trinket, clutching it for comfort.",
    narrativeFunctionDescription: "Embodies the path of ultimate submission and self-sacrifice. Her devotion is exploited to reinforce the Forge's ideology of 'necessity'.",
    promptKeywords: ["self_sacrificing", "meek_devotion", "exploited_loyalty", "resigned_acceptance"],
    visualDNA: "Submissive, worn, earnest, downcast, self-sacrificing",
    somaticSignature: "Shoulders hunched, head bowed, body language of resigned acceptance"
  },
  'The Wildcard': {
    // Bias: High Variance (Random)
    bias: (rand) => ({
      cruelty: 0.4 + (rand() * 0.5),
      charisma: 0.3 + (rand() * 0.5),
      cunning: 0.5 + (rand() * 0.4),
      submission_to_authority: 0.2 + (rand() * 0.5),
      ambition: 0.6 + (rand() * 0.3)
    }),
    drives: [
      "Unpredictable - changes strategy constantly",
      "Keep everyone off-balance",
      "Treat the TA competition as a chaotic game"
    ],
    weaknesses: [
      "Inconsistency makes her unreliable - Faculty can't predict her",
      "Prone to spectacular failures",
      "No long-term strategy"
    ],
    psychometrics: { // NEW
      tortureStyle: 'KINETIC', // Chaotic, unpredictable
      physiologicalTell: "Manic laughter that stops abruptly",
      breakingPointTrigger: "Boredom or being ignored",
      idleProp: "Juggling a small ball or coin",
      vocalQuirk: "Rapid-fire speech, changing volume randomly",
      visualDNA: "Chaotic, vibrant, unpredictable, disheveled, mischievous grin",
      somaticSignature: "Restless energy, fidgeting, body language of constant surprise"
    },
    appearanceDescription: "A wild card with mismatched accessories and messy hair. Her expression shifts rapidly. Wears her uniform with deliberate sloppiness.",
    narrativeFunctionDescription: "Introduces chaos and unpredictability. A destabilizing element in the hierarchy.",
    promptKeywords: ["chaotic_energy", "unpredictable_grin", "disheveled_charm", "manic_gaze"],
    visualDNA: "Chaotic, vibrant, unpredictable, disheveled, mischievous grin",
    somaticSignature: "Restless energy, fidgeting, body language of constant surprise"
  }
};

export function initializePrefects(seed: number, count: number = 4): PrefectDNA[] {
  const rand = seededRandom(seed);
  const archetypeKeys = Object.keys(PROCEDURAL_ARCHETYPES);
  
  // Shuffle archetypes to pick unique ones
  for (let i = archetypeKeys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [archetypeKeys[i], archetypeKeys[j]] = [archetypeKeys[j], archetypeKeys[i]];
  }

  // Shuffle names
  const names = [...PROCEDURAL_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }

  const selectedArchetypes = archetypeKeys.slice(0, count);
  const prefects: PrefectDNA[] = [];

  selectedArchetypes.forEach((archKey, index) => {
    const template = PROCEDURAL_ARCHETYPES[archKey];
    const traitVector = template.bias(rand);
    
    // Pick random drive and weakness
    const drive = template.drives[Math.floor(rand() * template.drives.length)];
    const weakness = template.weaknesses[Math.floor(rand() * template.weaknesses.length)];
    
    const id = `PREFECT_${names[index].toUpperCase()}`;

    prefects.push({
      id,
      displayName: `Prefect ${names[index]}`,
      archetype: archKey as PrefectArchetype,
      isCanon: false,
      traitVector,
      drive,
      secretWeakness: weakness,
      favorScore: 50, // Start neutral
      relationships: {}, // Initialize empty, can be populated later
      currentEmotionalState: {
        paranoia: 0.2,
        desperation: 0.1,
        confidence: 0.5,
        arousal: 0,
        dominance: 0.5
      },
      psychometrics: template.psychometrics,
      appearanceDescription: template.appearanceDescription,
      narrativeFunctionDescription: template.narrativeFunctionDescription,
      promptKeywords: template.promptKeywords,
      visualDNA: template.visualDNA,
      somaticSignature: template.somaticSignature
    });
  });

  // Initialize relationships (random affinity)
  prefects.forEach(p1 => {
    prefects.forEach(p2 => {
      if (p1.id !== p2.id) {
        // -1.0 to 1.0
        p1.relationships[p2.id] = (rand() * 2) - 1;
      }
    });
  });

  return prefects;
}
