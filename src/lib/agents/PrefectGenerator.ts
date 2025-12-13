
import { PrefectDNA, TraitVector, PrefectArchetype } from '../../types';

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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  'The Mimic': {
    // Bias: High Charisma/Ambition
    bias: (rand) => ({
      cruelty: 0.4 + (rand() * 0.2),
      charisma: 0.6 + (rand() * 0.2),
      cunning: 0.7 + (rand() * 0.2),
      submission_to_authority: 0.6 + (rand() * 0.2),
      ambition: 0.8 + (rand() * 0.15)
    }),
    drives: [
      "Copy successful Prefect strategies",
      "Become TA by being a perfect student",
      "Reflect the Faculty's desires back at them"
    ],
    weaknesses: [
      "Lacks originality - Faculty sees through imitation",
      "Identity crumbles under stress",
      "Dependent on others to lead"
    ]
  }
};

// --- 4. Canon Prefect Definitions (Immutable) ---
export const CANON_PREFECTS: Record<string, PrefectDNA> = {
  'ELARA': {
    id: 'PREFECT_LOYALIST',
    displayName: 'Elara',
    archetype: 'The Zealot',
    isCanon: true,
    traitVector: { cruelty: 0.6, charisma: 0.5, cunning: 0.4, submission_to_authority: 0.9, ambition: 0.8 },
    drive: "Prove ideological purity to secure TA position and validate the Forge's mission",
    secretWeakness: "Secretly horrified by the violence she orders - flinches at impact, then overcompensates with zealous justifications",
    favorScore: 65,
    relationships: {}
  },
  'KAELEN': {
    id: 'PREFECT_OBSESSIVE',
    displayName: 'Kaelen',
    archetype: 'The Yandere',
    isCanon: true,
    traitVector: { cruelty: 0.9, charisma: 0.7, cunning: 0.8, submission_to_authority: 0.3, ambition: 0.6 },
    drive: "Become TA to gain unrestricted access to Subject 84 for 'purification rituals'",
    secretWeakness: "Manic possession makes her unpredictable - Faculty sees her as unstable liability",
    favorScore: 45,
    relationships: {}
  },
  'RHEA': {
    id: 'PREFECT_DISSIDENT',
    displayName: 'Rhea',
    archetype: 'The Dissident',
    isCanon: true,
    traitVector: { cruelty: 0.2, charisma: 0.6, cunning: 0.9, submission_to_authority: 0.1, ambition: 0.7 },
    drive: "Become TA to undermine Faculty from position of power and avenge her brother",
    secretWeakness: "Her public cruelty is a performance - if caught helping Subjects, she's executed",
    favorScore: 55,
    relationships: {}
  },
  'ANYA': {
    id: 'PREFECT_NURSE',
    displayName: 'Anya',
    archetype: 'The Nurse',
    isCanon: true,
    traitVector: { cruelty: 0.5, charisma: 0.8, cunning: 0.7, submission_to_authority: 0.7, ambition: 0.9 },
    drive: "Become TA to access advanced medical research and secure family's influence",
    secretWeakness: "Her empathy is entirely performative - Subjects who discover this lose all hope",
    favorScore: 70,
    relationships: {}
  }
};

// --- 5. Generator Functions ---

function generateRandomPrefect(seed: number, index: number): PrefectDNA {
  const rand = seededRandom(seed + index);
  
  // 1. Pick Name
  const nameIndex = Math.floor(rand() * PROCEDURAL_NAMES.length);
  const name = PROCEDURAL_NAMES[nameIndex];
  
  // 2. Pick Archetype (Weighted? Uniform for now)
  const typeKeys = Object.keys(PROCEDURAL_ARCHETYPES);
  const typeIndex = Math.floor(rand() * typeKeys.length);
  const archetype = typeKeys[typeIndex];
  const template = PROCEDURAL_ARCHETYPES[archetype];
  
  // 3. Generate Traits via Bias Function
  const traits = template.bias(rand);
  
  // 4. Select Content
  const drive = template.drives[Math.floor(rand() * template.drives.length)];
  const weakness = template.weaknesses[Math.floor(rand() * template.weaknesses.length)];
  
  return {
    id: `PREFECT_PROC_${index}_${name.toUpperCase()}`,
    displayName: name,
    archetype: archetype as any, // Cast to PrefectArchetype
    isCanon: false,
    traitVector: {
      cruelty: Math.max(0, Math.min(1, traits.cruelty)),
      charisma: Math.max(0, Math.min(1, traits.charisma)),
      cunning: Math.max(0, Math.min(1, traits.cunning)),
      submission_to_authority: Math.max(0, Math.min(1, traits.submission_to_authority)),
      ambition: Math.max(0, Math.min(1, traits.ambition))
    },
    drive,
    secretWeakness: weakness,
    favorScore: 50, // Standard starting score
    relationships: {}
  };
}

export function initializePrefects(playthroughSeed: number): PrefectDNA[] {
  const prefects: PrefectDNA[] = [
    { ...CANON_PREFECTS['ELARA'] },
    { ...CANON_PREFECTS['KAELEN'] },
    { ...CANON_PREFECTS['RHEA'] },
    { ...CANON_PREFECTS['ANYA'] }
  ];

  // Generate 4 procedural prefects
  for (let i = 0; i < 4; i++) {
    prefects.push(generateRandomPrefect(playthroughSeed, i));
  }

  // Initialize Relationship Logic (from Prompt 2)
  prefects.forEach(p => {
    if (p.id === 'PREFECT_LOYALIST') {
      p.relationships['PREFECT_OBSESSIVE'] = -0.4;
      p.relationships['PREFECT_DISSIDENT'] = -0.3;
      p.relationships['PREFECT_NURSE'] = 0.2;
    }
    if (p.id === 'PREFECT_OBSESSIVE') {
      // Hates everyone
      prefects.forEach(target => {
        if (target.id !== p.id) p.relationships[target.id] = -0.6;
      });
    }
    if (p.id === 'PREFECT_DISSIDENT') {
      // Secretly allied with Defectors
      prefects.forEach(target => {
        if (target.archetype === 'The Defector') p.relationships[target.id] = 0.7;
        if (target.archetype === 'The Zealot') p.relationships[target.id] = -0.5;
      });
    }
    if (p.id === 'PREFECT_NURSE') {
      // Neutral
      prefects.forEach(target => {
        if (target.id !== p.id) p.relationships[target.id] = 0.1;
      });
    }
  });

  return prefects;
}
