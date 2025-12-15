
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
          public_actionSummary: { type: Type.STRING, nullable: true }, // Added public_actionSummary
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
              confidence: { type: Type.NUMBER },
              arousal: { type: Type.NUMBER, nullable: true }, // Added arousal
              dominance: { type: Type.NUMBER, nullable: true }, // Added dominance
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
      description: "List of atomic operations to update the Knowledge Graph of Thoughts.",
      items: {
        type: Type.OBJECT,
        properties: {
          operation: { 
            type: Type.STRING, 
            enum: [
                'add_node', 'update_node', 'remove_node', 'add_edge', 'update_edge', 'remove_edge',
                'add_memory', 'update_grudge', 'add_injury', 'add_trauma_bond', 'update_ledger_stat',
                'add_secret', 'update_phase', 'add_secret_alliance', 'add_trauma_memory', 'update_dominance',
                'add_psychosis_node', // Add new mutation types here
                'update_relationship', 'update_agent_emotion', 'inflict_somatic_trauma', 'reveal_secret'
            ]
          },
          // Flexible params object - exact shape validated by Zod at runtime
          node: { type: Type.OBJECT, nullable: true },
          edge: { type: Type.OBJECT, nullable: true },
          memory: { type: Type.OBJECT, nullable: true },
          // Flattened params for simpler mutations
          id: { type: Type.STRING, nullable: true },
          updates: { type: Type.OBJECT, nullable: true },
          source: { type: Type.STRING, nullable: true },
          target: { type: Type.STRING, nullable: true },
          delta: { type: Type.NUMBER, nullable: true },
          subject_id: { type: Type.STRING, nullable: true },
          injury: { type: Type.STRING, nullable: true },
          severity: { type: Type.NUMBER, nullable: true },
          strength: { type: Type.NUMBER, nullable: true },
          bond_type: { type: Type.STRING, nullable: true },
          stat: { type: Type.STRING, nullable: true },
          clamp: { type: Type.BOOLEAN, nullable: true },
          secret_id: { type: Type.STRING, nullable: true },
          description: { type: Type.STRING, nullable: true },
          discovered_by: { type: Type.STRING, nullable: true },
          turn_discovered: { type: Type.NUMBER, nullable: true },
          new_phase: { type: Type.STRING, nullable: true },
          members: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
          character_id: { type: Type.STRING, nullable: true },
          node_id: { type: Type.STRING, nullable: true },
          hallucination: { type: Type.STRING, nullable: true },
          intensity: { type: Type.NUMBER, nullable: true },
          
          // New Lore Mutation Parameters
          category: { type: Type.STRING, nullable: true },
          emotion: { type: Type.STRING, nullable: true },
          agent_id: { type: Type.STRING, nullable: true },
          location: { type: Type.STRING, nullable: true },
          revealed_to: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
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
    public_actionSummary?: string; // Added here for type consistency
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
      arousal?: number; // Added arousal
      dominance?: number; // Added dominance
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
  kgot_mutations?: Array<any>;
  psychosis_text?: string;
  audio_cues?: Array<{
    mode: string;
    text_fragment: string;
  }>;
  audio_markup?: string;
}
