

import { PrefectDNA, PrefectArchetype, CharacterId } from '../types';

// --- PRNG (Mulberry32) ---
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROCEDURAL_NAMES = [
  "Isadora", "Cressida", "Thalia", "Vivienne", "Lucian", "Cassian", 
  "Damien", "Soren", "Vesper", "Nyx", "Lux", "Morrigan", "Seraphine", 
  "Octavia", "Celeste", "Dorian", "Elysia", "Faelan", "Giselle", "Helena"
];

// --- CANON PREFECTS ---

const CANON_PREFECTS: PrefectDNA[] = [
  {
    id: CharacterId.LOYALIST,
    displayName: "Elara",
    archetype: 'The Zealot',
    isCanon: true,
    traitVector: { cruelty: 0.6, charisma: 0.5, cunning: 0.4, submission_to_authority: 0.9, ambition: 0.8 },
    drive: "Prove ideological purity to secure TA position and validate the Forge's mission",
    secretWeakness: "Secretly horrified by the violence she orders - flinches at impact, then overcompensates with zealous justifications",
    favorScore: 65,
    relationships: {}
  },
  {
    id: CharacterId.OBSESSIVE,
    displayName: "Kaelen",
    archetype: 'The Yandere',
    isCanon: true,
    traitVector: { cruelty: 0.9, charisma: 0.7, cunning: 0.8, submission_to_authority: 0.3, ambition: 0.6 },
    drive: "Become TA to gain unrestricted access to Subject 84 for 'purification rituals'",
    secretWeakness: "Manic possession makes her unpredictable - Faculty sees her as unstable liability",
    favorScore: 45,
    relationships: {}
  },
  {
    id: CharacterId.DISSIDENT,
    displayName: "Rhea",
    archetype: 'The Dissident',
    isCanon: true,
    traitVector: { cruelty: 0.2, charisma: 0.6, cunning: 0.9, submission_to_authority: 0.1, ambition: 0.7 },
    drive: "Become TA to undermine Faculty from position of power and avenge her brother",
    secretWeakness: "Her public cruelty is a performance - if caught helping Subjects, she's executed",
    favorScore: 55,
    relationships: {}
  },
  {
    id: CharacterId.NURSE,
    displayName: "Anya",
    archetype: 'The Nurse',
    isCanon: true,
    traitVector: { cruelty: 0.5, charisma: 0.8, cunning: 0.7, submission_to_authority: 0.7, ambition: 0.9 },
    drive: "Become TA to access advanced medical research and secure family's influence",
    secretWeakness: "Her empathy is entirely performative - Subjects who discover this lose all hope",
    favorScore: 70,
    relationships: {}
  }
];

// --- PROCEDURAL ARCHETYPE DEFINITIONS ---

interface ArchetypeDef {
  bias: {
    cruelty: [number, number];
    charisma: [number, number];
    cunning: [number, number];
    submission: [number, number];
    ambition: [number, number];
  };
  driveTemplates: string[];
  weaknessTemplates: string[];
}

const PROCEDURAL_ARCHETYPES: Record<string, ArchetypeDef> = {
  'The Sadist': {
    bias: { cruelty: [0.85, 0.95], charisma: [0.3, 0.6], cunning: [0.4, 0.7], submission: [0.6, 0.8], ambition: [0.7, 0.9] },
    driveTemplates: ["Perfect the art of kinetic trauma to impress Petra", "Discover new pain thresholds for thesis"],
    weaknessTemplates: ["Enjoys cruelty too much - Faculty sees as liability", "Lacks subtlety - leaves evidence"]
  },
  'The Defector': {
    bias: { cruelty: [0.1, 0.3], charisma: [0.5, 0.7], cunning: [0.7, 0.9], submission: [0.1, 0.3], ambition: [0.8, 0.95] },
    driveTemplates: ["Become TA to sabotage from within", "Gather evidence for mainland authorities"],
    weaknessTemplates: ["Secretly aligned with Mara - if discovered, both are executed"]
  },
  'The Voyeur': {
    bias: { cruelty: [0.4, 0.6], charisma: [0.2, 0.4], cunning: [0.6, 0.8], submission: [0.7, 0.9], ambition: [0.5, 0.7] },
    driveTemplates: ["Document rituals for personal study", "Become TA to observe without participating"],
    weaknessTemplates: ["Prefers watching to acting - Faculty questions her commitment"]
  },
  'The Parasite': {
    bias: { cruelty: [0.3, 0.5], charisma: [0.7, 0.9], cunning: [0.8, 0.95], submission: [0.5, 0.7], ambition: [0.9, 0.95] },
    driveTemplates: ["Attach to frontrunner and mirror their success", "Sabotage leader then replace them"],
    weaknessTemplates: ["Has no original methods - easily exposed as fraud"]
  },
  'The Perfectionist': {
    bias: { cruelty: [0.6, 0.8], charisma: [0.4, 0.6], cunning: [0.7, 0.9], submission: [0.8, 0.95], ambition: [0.85, 0.95] },
    driveTemplates: ["Execute flawless rituals to prove superiority", "Never make a mistake Faculty could criticize"],
    weaknessTemplates: ["Paralyzed by fear of imperfection - cracks under pressure"]
  },
  'The Martyr': {
    bias: { cruelty: [0.5, 0.7], charisma: [0.6, 0.8], cunning: [0.3, 0.5], submission: [0.9, 0.95], ambition: [0.6, 0.8] },
    driveTemplates: ["Sacrifice everything for the Forge's mission", "Prove devotion through extreme acts"],
    weaknessTemplates: ["Self-destructive loyalty - Faculty exploits without rewarding"]
  },
  'The Wildcard': {
    bias: { cruelty: [0.4, 0.9], charisma: [0.3, 0.8], cunning: [0.5, 0.9], submission: [0.2, 0.7], ambition: [0.6, 0.9] },
    driveTemplates: ["Unpredictable - changes strategy constantly", "Keep everyone off-balance"],
    weaknessTemplates: ["Inconsistency makes her unreliable - Faculty can't predict her"]
  },
  'The Mimic': {
    bias: { cruelty: [0.4, 0.6], charisma: [0.6, 0.8], cunning: [0.7, 0.9], submission: [0.6, 0.8], ambition: [0.8, 0.95] },
    driveTemplates: ["Copy successful Prefect strategies", "Become TA by being a perfect student"],
    weaknessTemplates: ["Lacks originality - Faculty sees through imitation"]
  },
  'The Brat Princess': {
    bias: { cruelty: [0.3, 0.5], charisma: [0.8, 0.95], cunning: [0.5, 0.7], submission: [0.4, 0.6], ambition: [0.9, 1.0] },
    driveTemplates: ["Use charm and entitlement to manipulate Faculty and Prefects", "Secure TA position through social dominance"],
    weaknessTemplates: ["Spoiled and entitled - underestimates rivals", "Faculty tolerates her for political reasons but doubts loyalty"]
  },
  'The Siren': {
    bias: { cruelty: [0.4, 0.6], charisma: [0.9, 1.0], cunning: [0.6, 0.8], submission: [0.5, 0.7], ambition: [0.8, 0.95] },
    driveTemplates: ["Enchant Subjects and Faculty alike to gain influence", "Use seduction as a weapon to control outcomes"],
    weaknessTemplates: ["Overreliance on seduction - vulnerable to exposure", "Emotional manipulation can backfire"]
  },
  'The Psychologist': {
    bias: { cruelty: [0.2, 0.4], charisma: [0.7, 0.9], cunning: [0.8, 1.0], submission: [0.6, 0.8], ambition: [0.7, 0.9] },
    driveTemplates: ["Analyze and exploit psychological weaknesses of Subjects and Prefects", "Become TA to implement new conditioning protocols"],
    weaknessTemplates: ["Overthinks and hesitates", "Faculty distrusts her for being too cerebral"]
  },
  'The Contender': {
    bias: { cruelty: [0.5, 0.7], charisma: [0.6, 0.8], cunning: [0.7, 0.9], submission: [0.5, 0.7], ambition: [0.85, 1.0] },
    driveTemplates: ["Prove herself as the best candidate through ruthless competition", "Outperform all rivals in study sessions and rituals"],
    weaknessTemplates: ["Overconfidence leads to mistakes", "Faculty views her as a threat to balance"]
  }
};

// --- GENERATOR HELPERS ---

function getRandomInRange(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

function getRandomItem<T>(rand: () => number, items: T[]): T {
  const idx = Math.floor(rand() * items.length);
  return items[idx];
}

export function generateRandomPrefect(seed: number, index: number, usedNames: Set<string>): PrefectDNA {
  const rng = seededRandom(seed + index);
  
  // Select Archetype
  const archetypeKeys = Object.keys(PROCEDURAL_ARCHETYPES) as PrefectArchetype[];
  const archetype = getRandomItem(rng, archetypeKeys);
  const def = PROCEDURAL_ARCHETYPES[archetype];
  
  // Name generation
  let name = getRandomItem(rng, PROCEDURAL_NAMES);
  let attempt = 0;
  while (usedNames.has(name) && attempt < 50) {
    name = getRandomItem(rng, PROCEDURAL_NAMES);
    attempt++;
  }
  usedNames.add(name);

  const id = `PREFECT_${name.toUpperCase()}_${index}`;
  
  // Trait Generation based on bias
  const traits = {
    cruelty: getRandomInRange(rng, def.bias.cruelty[0], def.bias.cruelty[1]),
    charisma: getRandomInRange(rng, def.bias.charisma[0], def.bias.charisma[1]),
    cunning: getRandomInRange(rng, def.bias.cunning[0], def.bias.cunning[1]),
    submission_to_authority: getRandomInRange(rng, def.bias.submission[0], def.bias.submission[1]),
    ambition: getRandomInRange(rng, def.bias.ambition[0], def.bias.ambition[1])
  };

  const drive = getRandomItem(rng, def.driveTemplates);
  const secretWeakness = getRandomItem(rng, def.weaknessTemplates);

  return {
    id,
    displayName: name,
    archetype,
    isCanon: false,
    traitVector: traits,
    drive,
    secretWeakness,
    favorScore: 50, // Standard procedural start
    relationships: {}
  };
}

export function initializePrefects(playthroughSeed: number): PrefectDNA[] {
  const allPrefects: PrefectDNA[] = [...JSON.parse(JSON.stringify(CANON_PREFECTS))];
  const usedNames = new Set<string>();

  // Generate 4 procedural prefects
  for (let i = 0; i < 4; i++) {
    allPrefects.push(generateRandomPrefect(playthroughSeed, i, usedNames));
  }

  // Initialize Relationship Matrix
  for (const prefect of allPrefects) {
    prefect.relationships = {};
    
    for (const other of allPrefects) {
      if (prefect.id === other.id) continue;

      let score = 0;

      // --- ELARA (The Zealot) Logic ---
      if (prefect.id === CharacterId.LOYALIST) {
        if (other.id === CharacterId.OBSESSIVE) score = -0.4;
        else if (other.id === CharacterId.DISSIDENT) score = -0.3;
        else if (other.id === CharacterId.NURSE) score = 0.2;
      }
      
      // --- KAELEN (The Yandere) Logic ---
      else if (prefect.id === CharacterId.OBSESSIVE) {
        score = -0.6; // Hates everyone
      }

      // --- RHEA (The Dissident) Logic ---
      else if (prefect.id === CharacterId.DISSIDENT) {
        if (other.archetype === 'The Defector') score = 0.7;
        else if (other.archetype === 'The Zealot') score = -0.5;
      }

      // --- ANYA (The Nurse) Logic ---
      else if (prefect.id === CharacterId.NURSE) {
        score = 0.1; // Professional neutrality
      }

      // --- PROCEDURAL LOGIC ---
      else {
        // Procedural Prefects generally dislike highly ambitious rivals
        if (other.traitVector.ambition > 0.9) score -= 0.2;
        // They respect high charisma
        if (other.traitVector.charisma > 0.8) score += 0.2;
      }

      prefect.relationships[other.id] = parseFloat(score.toFixed(2));
    }
  }

  return allPrefects;
}