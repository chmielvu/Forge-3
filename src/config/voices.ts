
import { CharacterId } from '../types';

/**
 * Character Voice Mapping for Gemini TTS
 * Voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
 */
export const CHARACTER_VOICE_MAP: Record<string, string> = {
  // FACULTY
  [CharacterId.PROVOST]: 'Zephyr', // Authoritative, Calm, Female
  [CharacterId.INQUISITOR]: 'Fenrir', // Aggressive, Wild
  [CharacterId.LOGICIAN]: 'Charon', // Deep, Analytical, Male tone (Clinical)
  [CharacterId.CONFESSOR]: 'Kore', // Soft, Whispering, Female
  [CharacterId.ASTRA]: 'Puck', // Anxious, Higher pitch
  [CharacterId.PHYSICUS]: 'Fenrir', // Sharp

  // PREFECTS
  [CharacterId.OBSESSIVE]: 'Kore', // Dere-mode (Soft)
  [CharacterId.LOYALIST]: 'Puck', // Brittle, Sharp
  [CharacterId.DISSIDENT]: 'Fenrir', // Intense
  [CharacterId.NURSE]: 'Puck', // Deceptively warm

  // SUBJECTS
  [CharacterId.PLAYER]: 'Puck', // Internal monologue
  [CharacterId.NICO]: 'Fenrir', // Defiant, Rough
  [CharacterId.DARIUS]: 'Charon', // Deep, Broken, Protective
  [CharacterId.SILAS]: 'Puck', // Quiet, Calculating
  [CharacterId.THEO]: 'Puck', // High, Trembling

  // SYSTEM
  'Narrator': 'Charon',
  'System': 'Zephyr'
};

export const resolveVoiceForSpeaker = (speaker: string): string => {
    const upper = speaker.toUpperCase();
    
    // Direct ID Match
    if (CHARACTER_VOICE_MAP[speaker]) return CHARACTER_VOICE_MAP[speaker];

    // Fuzzy Match Name
    if (upper.includes("SELENE")) return CHARACTER_VOICE_MAP[CharacterId.PROVOST];
    if (upper.includes("PETRA")) return CHARACTER_VOICE_MAP[CharacterId.INQUISITOR];
    if (upper.includes("LYSANDRA")) return CHARACTER_VOICE_MAP[CharacterId.LOGICIAN];
    if (upper.includes("CALISTA")) return CHARACTER_VOICE_MAP[CharacterId.CONFESSOR];
    if (upper.includes("ASTRA")) return CHARACTER_VOICE_MAP[CharacterId.ASTRA];
    if (upper.includes("ELARA")) return CHARACTER_VOICE_MAP[CharacterId.LOYALIST];
    if (upper.includes("KAELEN")) return CHARACTER_VOICE_MAP[CharacterId.OBSESSIVE];
    if (upper.includes("RHEA")) return CHARACTER_VOICE_MAP[CharacterId.DISSIDENT];
    if (upper.includes("ANYA")) return CHARACTER_VOICE_MAP[CharacterId.NURSE];
    if (upper.includes("NICO")) return CHARACTER_VOICE_MAP[CharacterId.NICO];
    if (upper.includes("DARIUS")) return CHARACTER_VOICE_MAP[CharacterId.DARIUS];
    if (upper.includes("SILAS")) return CHARACTER_VOICE_MAP[CharacterId.SILAS];
    if (upper.includes("THEO")) return CHARACTER_VOICE_MAP[CharacterId.THEO];
    
    if (upper.includes("NARRATOR") || upper.includes("SYSTEM")) return 'Charon';
    
    return 'Zephyr'; // Default fallback
};
