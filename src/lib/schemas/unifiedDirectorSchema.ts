
import { Type } from "@google/genai";

/**
 * UNIFIED DIRECTOR OUTPUT SCHEMA (AGoT v2025)
 * Implements Adaptive Graph-of-Thoughts for separation of Causal Physics (Fabula) 
 * and Narrative Discourse (Sjuzhet).
 */
export const UnifiedDirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    // === PART 1: ADAPTIVE GRAPH-OF-THOUGHTS (AGoT) ===
    agot_trace: { 
      type: Type.OBJECT,
      description: "The cognitive graph structure separating simulation from rendering.",
      properties: {
        complexity: { 
            type: Type.STRING, 
            enum: ["LINEAR_CHAIN", "BRANCHING_TREE", "ENTANGLED_GRAPH"],
            description: "Assessment of scene complexity based on ledger deltas and rivalries." 
        },
        fabula: { 
            type: Type.ARRAY, 
            description: "PHASE 1: The 'Physics' of the scene. Chronological, raw causal events. NO FLUFF.",
            items: { 
              type: Type.OBJECT,
              properties: {
                event_id: { type: Type.STRING },
                cause: { type: Type.STRING },
                effect: { type: Type.STRING },
                state_impact: { type: Type.STRING } // e.g. "Trauma +5"
              }
            } 
        },
        sjuzhet_strategy: { 
            type: Type.OBJECT, 
            description: "PHASE 2: The 'Discourse'. How the Fabula is distorted for the Subject.",
            properties: {
              focalization: { type: Type.STRING, enum: ["Lucid", "Somatic_Fixation", "Dissociated", "Psychotic"] },
              time_distortion: { type: Type.STRING, description: "e.g., 'Slow motion during impact', 'Time skip'" },
              aesthetic_focus: { type: Type.STRING, description: "Which motif governs this beat? (e.g., 'Volcanic Haze')" }
            }
        },
        critique: { 
          type: Type.STRING,
          description: "Final check against Aesthete's Rules (Banned words, Lighting)."
        }
      },
      required: ["complexity", "fabula", "sjuzhet_strategy", "critique"]
    },

    // === PART 2: PREFECT SIMULATION ===
    prefect_simulations: {
      type: Type.ARRAY,
      description: "Simulated thoughts/actions for all active prefects in the scene",
      items: {
        type: Type.OBJECT,
        properties: {
          prefect_id: { type: Type.STRING },
          prefect_name: { type: Type.STRING },
          
          current_scene_goal: { type: Type.STRING },
          public_action: { type: Type.STRING },
          hidden_motivation: { type: Type.STRING },
          internal_monologue: { type: Type.STRING },
          
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
          
          emotional_state: {
            type: Type.OBJECT,
            properties: {
              paranoia: { type: Type.NUMBER },
              desperation: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER }
            }
          },
          secrets_uncovered: { type: Type.ARRAY, items: { type: Type.STRING } },
          favor_score_delta: { type: Type.NUMBER }
        },
        required: ['prefect_id', 'current_scene_goal', 'public_action', 'hidden_motivation', 'emotional_state']
      }
    },
    
    // === PART 3: NARRATIVE OUTPUT ===
    script: {
      type: Type.ARRAY,
      description: "The scene formatted as a screenplay script. Separate narration from dialogue.",
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, description: "Name of the speaker, or 'Narrator'." },
          text: { type: Type.STRING, description: "The spoken text or narration." },
          emotion: { type: Type.STRING, description: "Emotional tone for TTS (e.g., 'Whisper', 'Shout', 'Clinical')." }
        },
        required: ["speaker", "text"]
      }
    },

    somatic_state: {
      type: Type.OBJECT,
      description: "Player's internal physiological experience (e.g. 'Abdominal Void', 'Systemic Shock').",
      properties: {
        impact_sensation: { type: Type.STRING },
        internal_collapse: { type: Type.STRING }
      },
      required: ["impact_sensation", "internal_collapse"]
    },
    
    narrative_text: { 
      type: Type.STRING,
      description: "The final Sjuzhet-rendered prose. Must adhere to the 'Banned Words' list."
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
            enum: ['add_edge', 'update_node', 'add_memory', 'update_grudge', 'add_trauma_bond', 'update_ledger', 'add_injury', 'add_subject_secret', 'apply_vicarious_trauma'] 
          },
          params: { type: Type.OBJECT, nullable: true }
        }
      },
      nullable: true
    },
    
    psychosis_text: { type: Type.STRING, nullable: true },

    audio_cues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          mode: { type: Type.STRING, enum: ['Mocking Jester', 'Seductive Dominatrix', 'Clinical Analyst', 'Sympathetic Confidante'] },
          text_fragment: { type: Type.STRING, description: "The specific text segment to apply this voice mode to." }
        }
      },
      nullable: true
    },

    audio_markup: { type: Type.STRING, nullable: true, description: "Narrative text formatted with SSML-like tags for TTS." }
  },
  required: [
    "agot_trace", 
    "prefect_simulations",
    "script",
    "narrative_text", 
    "visual_prompt", 
    "choices", 
    "somatic_state"
  ]
};

// Type definition for TypeScript
export interface UnifiedDirectorOutput {
  agot_trace: { 
    complexity: string;
    fabula: Array<{ event_id: string; cause: string; effect: string; state_impact: string }>;
    sjuzhet_strategy: { focalization: string; time_distortion: string; aesthetic_focus: string };
    critique: string;
  };
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
  script: Array<{
    speaker: string;
    text: string;
    emotion?: string;
  }>;
  somatic_state: {
    impact_sensation: string;
    internal_collapse: string;
  };
  narrative_text: string;
  visual_prompt: string;
  choices: string[];
  ledger_update?: Partial<any>;
  kgot_mutations?: Array<{
    operation: string;
    params?: any;
  }>;
  psychosis_text?: string;
  audio_cues?: Array<{
    mode: string;
    text_fragment: string;
  }>;
  audio_markup?: string;
}
