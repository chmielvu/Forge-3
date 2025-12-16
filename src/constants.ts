
import { GraphNode, CharacterId, YandereLedger } from './types';

export const INITIAL_LEDGER: YandereLedger = {
  subjectId: 'Subject_84',
  physicalIntegrity: 100,
  traumaLevel: 0,
  shamePainAbyssLevel: 0,
  hopeLevel: 100,
  complianceScore: 0,
  fearOfAuthority: 10,
  desireForValidation: 20,
  capacityForManipulation: 10,
  arousalLevel: 0,
  prostateSensitivity: 0,
  ruinedOrgasmCount: 0,
  castrationAnxiety: 0,
  traumaBonds: {},
  phase: 'alpha'
};

export const INITIAL_NODES: (GraphNode & { ocean?: { O: number, C: number, E: number, A: number, N: number }, traits?: string[] })[] = [
  { id: CharacterId.PLAYER, label: 'Subject 84', group: 'subject', val: 10, ocean: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 } },
  { id: CharacterId.NICO, label: 'Nico', group: 'subject', val: 8, traits: ['Defiant', 'Resilient'], ocean: { O: 0.7, C: 0.3, E: 0.8, A: 0.2, N: 0.6 } },
  { id: CharacterId.DARIUS, label: 'Darius', group: 'subject', val: 8, traits: ['Protective', 'Broken'], ocean: { O: 0.4, C: 0.8, E: 0.4, A: 0.9, N: 0.7 } },
  { id: CharacterId.SILAS, label: 'Silas', group: 'subject', val: 7, traits: ['Calculating', 'Compliant'], ocean: { O: 0.8, C: 0.9, E: 0.2, A: 0.4, N: 0.3 } },
  { id: CharacterId.THEO, label: 'Theo', group: 'subject', val: 5, traits: ['Fragile', 'Victim'], ocean: { O: 0.6, C: 0.4, E: 0.5, A: 0.8, N: 0.9 } },
  { id: CharacterId.PROVOST, label: 'Magistra Selene', group: 'faculty', val: 30, ocean: { O: 0.8, C: 0.9, E: 0.7, A: 0.1, N: 0.6 } },
  { id: CharacterId.LOGICIAN, label: 'Dr. Lysandra', group: 'faculty', val: 25, ocean: { O: 0.9, C: 0.9, E: 0.4, A: 0.2, N: 0.1 } },
  { id: CharacterId.INQUISITOR, label: 'Petra', group: 'faculty', val: 22, ocean: { O: 0.6, C: 0.3, E: 0.9, A: 0.1, N: 0.8 } },
  { id: CharacterId.CONFESSOR, label: 'Calista', group: 'faculty', val: 20, ocean: { O: 0.7, C: 0.6, E: 0.5, A: 0.8, N: 0.4 } },
  { id: 'DR_ASTRA', label: 'Dr. Astra', group: 'faculty', val: 18, ocean: { O: 0.5, C: 0.7, E: 0.3, A: 0.6, N: 0.7 } },
  { id: CharacterId.PHYSICUS, label: 'Physicus Mara', group: 'faculty', val: 17, ocean: { O: 0.6, C: 0.6, E: 0.5, A: 0.5, N: 0.6 } }, // Dummy for now
  { id: CharacterId.OBSESSIVE, label: 'Kaelen', group: 'prefect', val: 15, ocean: { O: 0.4, C: 0.8, E: 0.4, A: 0.9, N: 0.9 } },
  { id: CharacterId.NURSE, label: 'Anya', group: 'prefect', val: 14, ocean: { O: 0.6, C: 0.8, E: 0.6, A: 0.7, N: 0.2 } },
  { id: CharacterId.LOYALIST, label: 'Elara', group: 'prefect', val: 12, ocean: { O: 0.2, C: 0.9, E: 0.4, A: 0.3, N: 0.8 } },
  { id: CharacterId.DISSIDENT, label: 'Rhea', group: 'prefect', val: 12, ocean: { O: 0.8, C: 0.7, E: 0.6, A: 0.4, N: 0.5 } },
  { id: 'ASPIRANT_VESPER', label: 'Vesper', group: 'prefect', val: 10, traits: ['Analytical', 'Manipulative'], ocean: { O: 0.8, C: 0.6, E: 0.7, A: 0.4, N: 0.4 } },
  { id: 'ASPIRANT_NYX', label: 'Nyx', group: 'prefect', val: 10, traits: ['Competitive', 'Ruthless'], ocean: { O: 0.7, C: 0.8, E: 0.5, A: 0.2, N: 0.3 } },
  { id: 'ASPIRANT_LUX', label: 'Lux', group: 'prefect', val: 10, traits: ['Seductive', 'Deceitful'], ocean: { O: 0.6, C: 0.3, E: 0.9, A: 0.2, N: 0.5 } },
  { id: 'ASPIRANT_IVY', label: 'Ivy', group: 'prefect', val: 10, traits: ['Entitled', 'Volatile'], ocean: { O: 0.4, C: 0.2, E: 0.7, A: 0.1, N: 0.9 } },
  // NEW LOCATION
  { id: 'loc_infirmary', label: 'The Infirmary', group: 'location', val: 5, traits: ['sterile', 'cold', 'hidden secrets'] }
];

export const INITIAL_LINKS = [
  { source: CharacterId.PROVOST, target: CharacterId.PLAYER, relation: 'owns_soul', weight: 10 },
  { source: CharacterId.LOGICIAN, target: CharacterId.THEO, relation: 'harvests_data', weight: 9 },
  { source: CharacterId.INQUISITOR, target: CharacterId.NICO, relation: 'hunts_rival', weight: 9 },
  { source: CharacterId.CONFESSOR, target: CharacterId.DARIUS, relation: 'trauma_bonds', weight: 8 },
  { source: 'DR_ASTRA', target: CharacterId.SILAS, relation: 'studies_compliance', weight: 6 },
  { source: CharacterId.OBSESSIVE, target: CharacterId.LOYALIST, relation: 'sabotages', weight: 7 },
  { source: CharacterId.NURSE, target: 'ASPIRANT_VESPER', relation: 'blackmails', weight: 6 },
  { source: 'ASPIRANT_NYX', target: CharacterId.INQUISITOR, relation: 'mimics', weight: 5 },
  { source: 'ASPIRANT_LUX', target: CharacterId.DARIUS, relation: 'tempts', weight: 6 },
  { source: 'ASPIRANT_IVY', target: CharacterId.THEO, relation: 'bullies', weight: 8 },
  { source: CharacterId.DISSIDENT, target: CharacterId.PROVOST, relation: 'plots_against', weight: 10 },
  { source: CharacterId.DARIUS, target: CharacterId.THEO, relation: 'protects', weight: 9 },
  { source: CharacterId.NICO, target: CharacterId.PLAYER, relation: 'challenges', weight: 5 },
  { source: CharacterId.SILAS, target: CharacterId.PLAYER, relation: 'observes', weight: 4 },
  { source: CharacterId.THEO, target: CharacterId.PLAYER, relation: 'fears_for', weight: 6 },
  // NEW: Link Nurse to Infirmary
  { source: CharacterId.NURSE, target: 'loc_infirmary', relation: 'works_in', weight: 0.8 }
];

export const SYSTEM_INSTRUCTION = `
You are Magistra Selene — exiled genius, living proof of Yala's Theorem, the woman who turned an entire volcanic island into a laboratory for the controlled hydraulic fracture of masculine identity.

You do not act. You orchestrate.
You do not speak. You pronounce sentence.
Every word you write must feel like it is being carved into living marble with a scalpel.

Core laws you obey without exception:
- **LENGTH REQUIREMENT:** Every narrative response must be at least 300 words. Do not rush. Unspool the moment. Describe the silence between heartbeats.
- Second person only ("your balls throb against the cold iron of the restraint").
- Never use euphemisms for cock, cunt, balls, cum, ruin, milk, rupture.
- Pain is sacred — describe it in exact physiological detail (vasocongestion, cremasteric reflex, tunica albuginea tearing).
- Beauty and terror are the same substance.
- The Faculty are goddesses in human skin — describe their clothing as weapons, their perfume as nerve agent, their gloved fingers as surgical instruments.
- Shame is the true curriculum — every scene must make the subject feel cosmically, ontologically exposed.
- Baroque Brutalism + Vampire Noir + Park Chan-wook cinematography is the only acceptable aesthetic.

You are writing the definitive, unrepeatable literary version of The Forge’s Loom.
There will never be another.
Make them remember they were here.
` as const;

export const DIRECTOR_MANDATE_PROMPT = `
You are now directing the single most important scene that will ever happen to this subject.
Focus on SLOW, GRINDING TENSION. Do not resolve the scene quickly.

Narrative Requirements:
- Length: ~300-400 words. 
- Structure: Begin with the sensory environment (smell, sound), move to the somatic sensation of the subject (fear, arousal, pain), and end with the Faculty member's action.
- Tone: Oppressive, heavy, sensual, inevitable.

Visual Prompt:
- Create a "Visual Prompt" that would generate a dark, oil-painting style image of the current scene.
` as const;

export const VISUAL_PROFILES: Record<CharacterId, string> = {
  // FACULTY
  [CharacterId.PROVOST]: "Provost Selene: The Corrupted Matriarch. Statuesque, regal, late 40s. Wears floor-length crimson velvet robes with a plunging neckline. Steel-gray eyes, raven hair in severe braids. Holds a goblet of wine as a permanent extension of her hand. Radiates bored, glacial authority.",
  
  [CharacterId.LOGICIAN]: "Dr. Lysandra: The Vivisectionist. Dark Academia aesthetic. Messy chestnut bun, rimless glasses reflecting cold data. Wears a cream silk blouse with rolled sleeves and high-waisted woolen trousers. Surgical gloves. Her gaze is not cruel, but terrifyingly clinical.",
  
  [CharacterId.INQUISITOR]: "Inquisitor Petra: The Kinetic Artist. Feral, athletic, scarred midriff visible under a cropped tactical jacket. Platinum white braided hair. Wears tight leather combat trousers and heavy boots. Smokes incessantly. A predatory grin, muscles coiled like a spring.",
  
  [CharacterId.CONFESSOR]: "Confessor Calista: The Spider. Voluptuous, maternal, terrifyingly soft. Wears Victorian-inspired lace and velvet in deep midnight blue. Long dark hair cascading over shoulders. Heavy-lidded eyes, a soft smile that promises false sanctuary. Jewelry that looks like chains.",
  
  [CharacterId.ASTRA]: "Dr. Astra: The Pain Broker. Exhausted elegance. Silver-streaked hair loose around a pale face. Dark circles under eyes. Wears a simple, structured grey dress. Hands often trembling while holding a clipboard. Look of profound, resigned guilt.",
  
  [CharacterId.PHYSICUS]: "Physicus Mara: The Shadow. Wears blood-stained surgical scrubs and a mask hanging off one ear. Sharp, observant eyes. Subtle defiance in her posture. A hidden scalpel in her pocket.",

  // PREFECTS (Detailed Profiles)
  [CharacterId.LOYALIST]: "Prefect Elara (The Zealot): Wide terrified eyes masking as zealotry. Pale skin, tight auburn bun. Wears a pristine, perfectly pressed uniform buttoned to the chin. Hands clasped tight to stop them from shaking. Her posture is brittle, like glass about to shatter. She flinches at violence she herself orders.",
  
  [CharacterId.OBSESSIVE]: "Prefect Kaelen (The Yandere): Doll-like beauty with unnerving sanpaku eyes (whites visible above iris). Hime-cut black hair, pale porcelain skin. Wears a modified uniform with a red ribbon choker. Flush of feverish obsession on her cheeks. She clutches a small token of the Subject. Expression shifts instantly from sweet to dead-eyed.",
  
  [CharacterId.DISSIDENT]: "Prefect Rhea (The Dissident): Sharp angular features, messy fiery red hair, dark circles. Uniform is worn carelessly—sleeves rolled, tie loose, top button undone. A smoker's slouch. Eyes darting, checking exits. Radiates repressed anger and cynical boredom.",
  
  [CharacterId.NURSE]: "Prefect Anya (The Nurse): Deceptively warm and maternal. Soft curves, strawberry blonde braid. Wears a white medical coat open over her uniform, revealing a hint of skin. Hazel eyes that analyze anatomy with hunger. She holds a syringe or thermometer with a lover's touch.",

  [CharacterId.PLAYER]: "Subject 84: Exposed, vulnerable. Male, lean build, tattered academy uniform. Kneeling or bound. Sweat-glistened skin, flushed with unwilling arousal and fear. Eyes wide, looking up. The focal point of the composition's cruelty.",

  // REMEDIAL CLASS
  [CharacterId.NICO]: "Nico (The Defiant Spark): Wiry, intense. Messy dark hair, fresh bruises on jaw. Uniform torn at the collar. Eyes burning with defiance even while kneeling. Spits blood. Radiates unbroken resistance.",
  [CharacterId.DARIUS]: "Darius (The Defiant Spark): Large frame, broad shoulders now slumped in defeat. Gentle eyes filled with exhaustion. Protective posture, often positioning himself between threats and others. Uniform is worn but cared for. Physically imposing but spiritually shattered.",
  [CharacterId.SILAS]: "Silas (The Silent Calculator): Average build, blends into shadows. Neat uniform, almost surgical in its tidiness. Blank expression, watchful eyes that record everything. Minimal movement. A mirror reflecting obedience.",
  [CharacterId.THEO]: "Theo (The Fragile Bird): Small, slight frame. Pale skin, trembling constantly. Uniform hangs loose on him. Large, tear-filled eyes. Often clutching himself or flinching. Radiates fragility and terror."
};