
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
  { id: 'NICO', label: 'Nico', group: 'subject', val: 8, ocean: { O: 0.7, C: 0.3, E: 0.8, A: 0.2, N: 0.6 } },
  { id: 'DARIUS', label: 'Darius', group: 'subject', val: 8, ocean: { O: 0.4, C: 0.8, E: 0.4, A: 0.9, N: 0.7 } },
  { id: 'SILAS', label: 'Silas', group: 'subject', val: 7, ocean: { O: 0.8, C: 0.9, E: 0.2, A: 0.4, N: 0.3 } },
  { id: 'THEO', label: 'Theo', group: 'subject', val: 5, ocean: { O: 0.6, C: 0.4, E: 0.5, A: 0.8, N: 0.9 } },
  { id: CharacterId.PROVOST, label: 'Magistra Selene', group: 'faculty', val: 30, ocean: { O: 0.8, C: 0.9, E: 0.7, A: 0.1, N: 0.6 } },
  { id: CharacterId.LOGICIAN, label: 'Dr. Lysandra', group: 'faculty', val: 25, ocean: { O: 0.9, C: 0.9, E: 0.4, A: 0.2, N: 0.1 } },
  { id: CharacterId.INQUISITOR, label: 'Petra', group: 'faculty', val: 22, ocean: { O: 0.6, C: 0.3, E: 0.9, A: 0.1, N: 0.8 } },
  { id: CharacterId.CONFESSOR, label: 'Calista', group: 'faculty', val: 20, ocean: { O: 0.7, C: 0.6, E: 0.5, A: 0.8, N: 0.4 } },
  { id: 'DR_ASTRA', label: 'Dr. Astra', group: 'faculty', val: 18, ocean: { O: 0.5, C: 0.7, E: 0.3, A: 0.6, N: 0.7 } },
  { id: CharacterId.OBSESSIVE, label: 'Kaelen', group: 'prefect', val: 15, ocean: { O: 0.4, C: 0.8, E: 0.4, A: 0.9, N: 0.9 } },
  { id: CharacterId.NURSE, label: 'Anya', group: 'prefect', val: 14, ocean: { O: 0.6, C: 0.8, E: 0.6, A: 0.7, N: 0.2 } },
  { id: CharacterId.LOYALIST, label: 'Elara', group: 'prefect', val: 12, ocean: { O: 0.2, C: 0.9, E: 0.4, A: 0.3, N: 0.8 } },
  { id: CharacterId.DISSIDENT, label: 'Rhea', group: 'prefect', val: 12, ocean: { O: 0.8, C: 0.7, E: 0.6, A: 0.4, N: 0.5 } },
  { id: 'ASPIRANT_VESPER', label: 'Vesper', group: 'prefect', val: 10, traits: ['Analytical', 'Manipulative'], ocean: { O: 0.8, C: 0.6, E: 0.7, A: 0.4, N: 0.4 } },
  { id: 'ASPIRANT_NYX', label: 'Nyx', group: 'prefect', val: 10, traits: ['Competitive', 'Ruthless'], ocean: { O: 0.7, C: 0.8, E: 0.5, A: 0.2, N: 0.3 } },
  { id: 'ASPIRANT_LUX', label: 'Lux', group: 'prefect', val: 10, traits: ['Seductive', 'Deceitful'], ocean: { O: 0.6, C: 0.3, E: 0.9, A: 0.2, N: 0.5 } },
  { id: 'ASPIRANT_IVY', label: 'Ivy', group: 'prefect', val: 10, traits: ['Entitled', 'Volatile'], ocean: { O: 0.4, C: 0.2, E: 0.7, A: 0.1, N: 0.9 } },
];

export const INITIAL_LINKS = [
  { source: CharacterId.PROVOST, target: CharacterId.PLAYER, relation: 'owns_soul', weight: 10 },
  { source: CharacterId.LOGICIAN, target: 'THEO', relation: 'harvests_data', weight: 9 },
  { source: CharacterId.INQUISITOR, target: 'NICO', relation: 'hunts_rival', weight: 9 },
  { source: CharacterId.CONFESSOR, target: 'DARIUS', relation: 'trauma_bonds', weight: 8 },
  { source: 'DR_ASTRA', target: 'SILAS', relation: 'studies_compliance', weight: 6 },
  { source: CharacterId.OBSESSIVE, target: CharacterId.LOYALIST, relation: 'sabotages', weight: 7 },
  { source: CharacterId.NURSE, target: 'ASPIRANT_VESPER', relation: 'blackmails', weight: 6 },
  { source: 'ASPIRANT_NYX', target: CharacterId.INQUISITOR, relation: 'mimics', weight: 5 },
  { source: 'ASPIRANT_LUX', target: 'DARIUS', relation: 'tempts', weight: 6 },
  { source: 'ASPIRANT_IVY', target: 'THEO', relation: 'bullies', weight: 8 },
  { source: CharacterId.DISSIDENT, target: CharacterId.PROVOST, relation: 'plots_against', weight: 10 },
  { source: 'DARIUS', target: 'THEO', relation: 'protects', weight: 9 },
  { source: 'NICO', target: CharacterId.PLAYER, relation: 'challenges', weight: 5 },
  { source: 'SILAS', target: CharacterId.PLAYER, relation: 'observes', weight: 4 },
  { source: 'THEO', target: CharacterId.PLAYER, relation: 'fears_for', weight: 6 },
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
  [CharacterId.PROVOST]: "Provost Selene: Regal, austere, crimson velvet robes, severe expression, platinum hair in a tight bun, imperious posture.",
  [CharacterId.LOGICIAN]: "Dr. Lysandra: Clinical, detached, sterile white lab coat, surgical gloves, eyes gleaming behind spectacles, precise movements.",
  [CharacterId.INQUISITOR]: "Inquisitor Petra: Feral, athletic, tight leather jumpsuit, riding crop, predatory grin, wild dark hair, volatile energy.",
  [CharacterId.CONFESSOR]: "Confessor Calista: Seductive, maternal, flowing silk gown, soft smile, comforting yet manipulative gaze, long dark hair, elegant hands.",
  [CharacterId.ASTRA]: "Dr. Astra: Empathetic, conflicted, simple grey uniform, weary eyes, hesitant posture, dark circles under eyes.",
  [CharacterId.PHYSICUS]: "Physicus Mara: Observant, cautious, blood-stained scrubs, surgical mask, intense eyes, subtle defiance, hiding something.",
  [CharacterId.NURSE]: "Nurse Anya: Overly solicitous, subtly cruel, starched white nurse's uniform, manicured nails, saccharine smile, a syringe held carefully.",
  [CharacterId.PLAYER]: "Subject 84: Exposed, vulnerable, kneeling, sweaty, eyes wide with fear and arousal, tattered uniform, bound wrists.",
  [CharacterId.OBSESSIVE]: "Kaelen: Possessive, intense, prefect uniform, clutching a favored object (e.g., a lock of hair, a small knife), darting eyes, a feverish blush.",
  [CharacterId.LOYALIST]: "Elara: Zealous, rigid, perfectly ironed prefect uniform, stern expression, hands clasped, unblinking stare, unwavering loyalty.",
  [CharacterId.DISSIDENT]: "Rhea: Rebellious, guarded, slightly disheveled prefect uniform, defiant stance, wary eyes, a hidden tool or message.",
};