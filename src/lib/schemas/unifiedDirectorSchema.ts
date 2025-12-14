
import { Type } from "@google/genai";

/**
 * UNIFIED DIRECTOR OUTPUT SCHEMA
 * Combines prefect simulation + narrative generation in ONE API call
 */
export const UnifiedDirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    // === PART 1: PREFECT SIMULATION (Replaces PrefectAgent calls) ===
    prefect_simulations: {
      type: Type.ARRAY,
      description: "Simulated thoughts/actions for all active prefects in the scene",
      items: {
        type: Type.OBJECT,
        properties: {
          prefect_id: { type: Type.STRING },
          prefect_name: { type: Type.STRING },
          
          // Core outputs (previously from PrefectAgent)
          current_scene_goal: {
            type: Type.STRING,
            description: "The specific short-term goal this agent is pursuing in this turn (e.g. 'Isolate Player', 'Enforce Rule')"
          },
          public_action: { 
            type: Type.STRING,
            description: "What this prefect does/says openly"
          },
          hidden_motivation: { 
            type: Type.STRING,
            description: "Their TRUE internal reasoning"
          },
          internal_monologue: { 
            type: Type.STRING,
            description: "Stream of consciousness"
          },
          
          // Social dynamics
          sabotage_attempt: {
            type: Type.OBJECT,
            properties: {
              target: { type: Type.STRING },
              method: { type: Type.STRING },
              deniability: { type: Type.NUMBER }
            },
            nullable: true
          },
          alliance_signal: {
            type: Type.OBJECT,
            properties: {
              target: { type: Type.STRING },
              message: { type: Type.STRING }
            },
            nullable: true
          },
          
          // State updates
          emotional_state: {
            type: Type.OBJECT,
            properties: {
              paranoia: { type: Type.NUMBER },
              desperation: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER }
            }
          },
          secrets_uncovered: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          favor_score_delta: { type: Type.NUMBER }
        },
        required: ['prefect_id', 'current_scene_goal', 'public_action', 'hidden_motivation', 'emotional_state']
      }
    },
    
    // === PART 2: NARRATIVE SYNTHESIS (Director's original role) ===
    thought_signature: { 
      type: Type.STRING,
      description: "The I-MCTS Execution Log. MUST format as: 'BRANCHES: [A: Trauma, B: Subversion, C: Novelty] -> EVALUATION: [Scores] -> SELECTION: [Chosen Branch]'"
    },
    
    somatic_state: {
      type: Type.OBJECT,
      description: "Player's internal physiological experience",
      properties: {
        impact_sensation: { type: Type.STRING },
        internal_collapse: { type: Type.STRING }
      },
      required: ["impact_sensation", "internal_collapse"]
    },
    
    narrative_text: { 
      type: Type.STRING,
      description: "The external observable scene with all prefect actions integrated. Must match the requested 'Abyss Narrator' voice mode."
    },
    
    audio_markup: {
      type: Type.STRING,
      description: "The narrative text wrapped in tags indicating emotional direction for TTS (e.g. [FAST], [WHISPER], [BREATHY])."
    },
    
    visual_prompt: { type: Type.STRING },
    choices: { type: Type.ARRAY, items: { type: Type.STRING } },
    
    ledger_update: {
      type: Type.OBJECT,
      properties: {
        physicalIntegrity: { type: Type.NUMBER, nullable: true },
        traumaLevel: { type: Type.NUMBER, nullable: true },
        shamePainAbyssLevel: { type: Type.NUMBER, nullable: true },
        hopeLevel: { type: Type.NUMBER, nullable: true },
        complianceScore: { type: Type.NUMBER, nullable: true },
        arousalLevel: { type: Type.NUMBER, nullable: true }
      },
      nullable: true
    },
    
    kgot_mutations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          operation: { 
            type: Type.STRING, 
            enum: ['add_edge', 'update_node', 'add_memory', 'update_grudge', 'add_trauma_bond', 'update_ledger'] 
          },
          params: { type: Type.OBJECT, nullable: true }
        }
      },
      nullable: true
    },
    
    audio_cues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          mode: { 
            type: Type.STRING, 
            enum: ['Mocking Jester', 'Seductive Dominatrix', 'Clinical Analyst', 'Sympathetic Confidante'] 
          },
          text_fragment: { type: Type.STRING }
        }
      },
      nullable: true
    },
    
    psychosis_text: { type: Type.STRING, nullable: true }
  },
  required: [
    "prefect_simulations",
    "thought_signature", 
    "narrative_text", 
    "visual_prompt", 
    "choices", 
    "somatic_state"
  ]
};

// Type definition for TypeScript
export interface UnifiedDirectorOutput {
  prefect_simulations: Array<{
    prefect_id: string;
    prefect_name: string;
    current_scene_goal: string;
    public_action: string;
    hidden_motivation: string;
    internal_monologue: string;
    sabotage_attempt?: {
      target: string;
      method: string;
      deniability: number;
    } | null;
    alliance_signal?: {
      target: string;
      message: string;
    } | null;
    emotional_state: {
      paranoia: number;
      desperation: number;
      confidence: number;
    };
    secrets_uncovered: string[];
    favor_score_delta: number;
  }>;
  thought_signature: string;
  somatic_state: {
    impact_sensation: string;
    internal_collapse: string;
  };
  narrative_text: string;
  audio_markup?: string;
  visual_prompt: string;
  choices: string[];
  ledger_update?: Partial<any>;
  kgot_mutations?: Array<{
    operation: string;
    params?: any;
  }>;
  audio_cues?: Array<{
    mode: string;
    text_fragment: string;
  }>;
  psychosis_text?: string;
}
