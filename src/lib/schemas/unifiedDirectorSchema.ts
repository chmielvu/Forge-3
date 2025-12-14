
import { Type } from "@google/genai";

/**
 * UNIFIED DIRECTOR OUTPUT SCHEMA
 * Combines prefect simulation + narrative generation in ONE API call
 */
export const UnifiedDirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    // === PART 1: COGNITIVE GRAPH TRACE (System 2 Deep Think) ===
    cognitive_graph: {
      type: Type.OBJECT,
      description: "Structured trace of the internal reasoning graph nodes (System 2).",
      properties: {
        analysis: { 
            type: Type.STRING, 
            description: "Node 1: Causal analysis of player input and impact prediction." 
        },
        hypotheses: { 
            type: Type.ARRAY, 
            description: "Node 2: The three narrative branches (Trauma, Subversion, Novelty).",
            items: { type: Type.STRING } 
        },
        evaluation: { 
            type: Type.STRING, 
            description: "Node 3: Scoring and selection logic (Tension/Coherence/Novelty)." 
        },
        synthesis_plan: { 
            type: Type.STRING, 
            description: "Node 4: Final execution plan based on the selected path." 
        }
      },
      required: ["analysis", "hypotheses", "evaluation", "synthesis_plan"]
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
    
    // === PART 3: NARRATIVE SCRIPT (New) ===
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
      description: "Player's internal physiological experience",
      properties: {
        impact_sensation: { type: Type.STRING },
        internal_collapse: { type: Type.STRING }
      },
      required: ["impact_sensation", "internal_collapse"]
    },
    
    narrative_text: { 
      type: Type.STRING,
      description: "The full combined narrative text for legacy logs."
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
    "cognitive_graph",
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
  cognitive_graph: {
    analysis: string;
    hypotheses: string[];
    evaluation: string;
    synthesis_plan: string;
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
