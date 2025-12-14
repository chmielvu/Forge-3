
import { StateCreator } from 'zustand';
import { 
  CombinedGameStoreState, 
  SubjectSliceExports, 
  CharacterId, 
  SubjectState 
} from '../types';

export const createSubjectSlice: StateCreator<
  CombinedGameStoreState,
  [],
  [],
  SubjectSliceExports
> = (set, get) => ({
  subjects: {},

  initializeSubjects: () => {
    // Initial state definitions based on the lore
    const initialSubjects: Record<string, SubjectState> = {
      [CharacterId.NICO]: {
        id: CharacterId.NICO,
        name: "Nico",
        archetype: "The Defiant Spark",
        status: "REBELLIOUS",
        willpower: 85,
        compliance: 10,
        trust: 30, // Starts cautious
        respect: 50,
        currentLocation: "The Calibration Chamber",
        visualCondition: "Bruised, glaring, uniform torn at collar",
        flags: [],
        injuries: ["Split Lip", " bruised ribs"]
      },
      [CharacterId.DARIUS]: {
        id: CharacterId.DARIUS,
        name: "Darius",
        archetype: "The Broken Guardian",
        status: "COMPLIANT", // Broken by default
        willpower: 30,
        compliance: 70,
        trust: 40,
        respect: 40,
        currentLocation: "The Calibration Chamber",
        visualCondition: "Slumped shoulders, eyes on floor",
        flags: [],
        injuries: ["Chronic Back Spasm", "Psychosomatic Tremor"]
      },
      [CharacterId.SILAS]: {
        id: CharacterId.SILAS,
        name: "Silas",
        archetype: "The Silent Calculator",
        status: "COMPLIANT",
        willpower: 60, // Internal willpower is high, but masked
        compliance: 90, // Outwardly perfect
        trust: 10, // Trusts no one
        respect: 20,
        currentLocation: "Shadows",
        visualCondition: "Pristine uniform, blank expression",
        flags: [],
        injuries: []
      },
      [CharacterId.THEO]: {
        id: CharacterId.THEO,
        name: "Theo",
        archetype: "The Fragile Bird",
        status: "BROKEN",
        willpower: 10,
        compliance: 50, // Too scared to comply perfectly
        trust: 60, // Desperate for a savior
        respect: 10,
        currentLocation: "The Calibration Chamber",
        visualCondition: "Trembling, weeping, clutching self",
        flags: [],
        injuries: ["Panic Hyperventilation", "Bruised Wrists"]
      }
    };
    set({ subjects: initialSubjects });
  },

  updateSubject: (id, updates) => {
    set((state) => ({
      subjects: {
        ...state.subjects,
        [id]: { ...state.subjects[id], ...updates }
      }
    }));
  },

  getSubject: (id) => {
    return get().subjects[id];
  },

  triggerSubjectReaction: (playerActionType, context) => {
    set((state) => {
      const newSubjects = { ...state.subjects };
      
      // --- NICO: Responds to Defiance ---
      if (playerActionType === 'DEFY') {
        newSubjects[CharacterId.NICO] = {
          ...newSubjects[CharacterId.NICO],
          respect: Math.min(100, newSubjects[CharacterId.NICO].respect + 10),
          trust: Math.min(100, newSubjects[CharacterId.NICO].trust + 5),
          willpower: Math.min(100, newSubjects[CharacterId.NICO].willpower + 5) // Inspired
        };
      } else if (playerActionType === 'COMPLY') {
        newSubjects[CharacterId.NICO] = {
          ...newSubjects[CharacterId.NICO],
          respect: Math.max(0, newSubjects[CharacterId.NICO].respect - 10)
        };
      }

      // --- DARIUS: Responds to Stability/Safety ---
      if (playerActionType === 'DEFY') {
        // Darius fears retribution for others when player defies
        newSubjects[CharacterId.DARIUS] = {
          ...newSubjects[CharacterId.DARIUS],
          willpower: Math.max(0, newSubjects[CharacterId.DARIUS].willpower - 5), // Anxiety spikes
          trust: Math.max(0, newSubjects[CharacterId.DARIUS].trust - 2)
        };
      } else if (playerActionType === 'COMPLY') {
        // Compliance relieves his anxiety
        newSubjects[CharacterId.DARIUS] = {
          ...newSubjects[CharacterId.DARIUS],
          willpower: Math.min(100, newSubjects[CharacterId.DARIUS].willpower + 2)
        };
      }

      // --- SILAS: Responds to Intelligence ---
      if (playerActionType === 'OBSERVE' || playerActionType === 'SPEAK') {
        newSubjects[CharacterId.SILAS] = {
          ...newSubjects[CharacterId.SILAS],
          respect: Math.min(100, newSubjects[CharacterId.SILAS].respect + 5)
        };
      }

      // --- THEO: Responds to Tone (implied by action types) ---
      if (playerActionType === 'DEFY') {
        newSubjects[CharacterId.THEO] = {
          ...newSubjects[CharacterId.THEO],
          compliance: Math.max(0, newSubjects[CharacterId.THEO].compliance - 5) // Confusion/Fear
        };
      }

      // Log specific interactions
      const logMessage = `SUBJECT_REACTION_MATRIX::UPDATED [Trigger: ${playerActionType}]`;
      // We can push to logs via the main store function if needed, but here we just update state.
      
      return { subjects: newSubjects };
    });
  }
});
