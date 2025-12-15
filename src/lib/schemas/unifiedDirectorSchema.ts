
import { Type } from "@google/genai";

// 1. The Atomic Thought Node (The "Neurons")
const GraphNodeSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    type: { 
      type: Type.STRING, 
      enum: ["FABULA_EVENT", "PREFECT_DRIVE", "CONFLICT_MERGE", "THEMATIC_ENFORCEMENT"],
      description: "FABULA=Raw Fact, PREFECT_DRIVE=Agent Goal, CONFLICT_MERGE=Synthesis of rivalries, THEMATIC_ENFORCEMENT=Engine rule application."
    },
    content: { type: Type.STRING, description: "The raw reasoning content." },
    meta_tags: { type: Type.ARRAY, items: { type: Type.STRING } } // e.g. ["Anatomical Determinism", "Gaslighting"]
  },
  required: ["id", "type", "content"]
};

// 2. The Directed Edge (The "Synapses")
const GraphEdgeSchema = {
  type: Type.OBJECT,
  properties: {
    from: { type: Type.STRING },
    to: { type: Type.STRING },
    relation: { type: Type.STRING, enum: ["CAUSES", "CONTRADICTS", "AMPLIFIES", "SYNTHESIZES"] }
  },
  required: ["from", "to", "relation"]
};

/**
 * UNIFIED DIRECTOR OUTPUT SCHEMA (Neuro-Symbolic Loom v2025)
 * Implements Thematic Engines and Graph-Based Reasoning.
 */
export const UnifiedDirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    // A. THE META-COGNITION LAYER
    meta_analysis: {
      type: Type.OBJECT,
      properties: {
        selected_engine: { 
          type: Type.STRING, 
          enum: ["PROTOCOL", "MASQUERADE", "SPECTACLE"],
          description: "Which Thematic Engine is driving this scene?"
        },
        player_psych_profile: {
          type: Type.STRING,
          description: "Brief analysis of player's 'Tone' (Defiant/Broken/Complicit)."
        }
      },
      required: ["selected_engine", "player_psych_profile"]
    },

    // B. THE ADAPTIVE GRAPH (Reasoning)
    reasoning_graph: {
      type: Type.OBJECT,
      properties: {
        nodes: { type: Type.ARRAY, items: GraphNodeSchema },
        edges: { type: Type.ARRAY, items: GraphEdgeSchema },
        selected_path: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["nodes", "edges", "selected_path"]
    },

    // C. THE ARTIFACTS (Presentation)
    narrative_text: { 
      type: Type.STRING, 
      description: "Final Baroque Brutalism prose. Must adhere to the Active Engine's vocabulary." 
    },
    visual_prompt: { 
      type: Type.STRING, 
      description: "Stable Diffusion prompt (Chiaroscuro/X-Ray/Cinematic)." 
    },
    choices: { type: Type.ARRAY, items: { type: Type.STRING } },

    script: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                speaker: { type: Type.STRING },
                text: { type: Type.STRING },
                emotion: { type: Type.STRING }
            }
        }
    },

    somatic_state: {
        type: Type.OBJECT,
        properties: {
            impact_sensation: { type: Type.STRING },
            internal_collapse: { type: Type.STRING }
        }
    },
    
    // D. STATE MUTATION (Legacy & Graph)
    prefect_simulations: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                prefect_id: { type: Type.STRING },
                prefect_name: { type: Type.STRING },
                current_scene_goal: { type: Type.STRING },
                public_action: { type: Type.STRING },
                public_actionSummary: { type: Type.STRING, nullable: true },
                hidden_motivation: { type: Type.STRING },
                internal_monologue: { type: Type.STRING },
                emotional_state: {
                    type: Type.OBJECT,
                    properties: {
                        paranoia: { type: Type.NUMBER },
                        desperation: { type: Type.NUMBER },
                        confidence: { type: Type.NUMBER },
                        arousal: { type: Type.NUMBER, nullable: true },
                        dominance: { type: Type.NUMBER, nullable: true }
                    }
                },
                sabotage_attempt: { type: Type.OBJECT, nullable: true, properties: { target: { type: Type.STRING }, method: { type: Type.STRING }, deniability: { type: Type.NUMBER } } },
                alliance_signal: { type: Type.OBJECT, nullable: true, properties: { target: { type: Type.STRING }, message: { type: Type.STRING } } },
                secrets_uncovered: { type: Type.ARRAY, items: { type: Type.STRING } },
                favor_score_delta: { type: Type.NUMBER }
            },
            required: ['prefect_id', 'public_action', 'emotional_state']
        }
    },

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
          operation: { type: Type.STRING },
          id: { type: Type.STRING, nullable: true },
          updates: { type: Type.OBJECT, nullable: true },
          // ... (simplified for brevity, Schema allows flexible objects)
          source: { type: Type.STRING, nullable: true },
          target: { type: Type.STRING, nullable: true },
          delta: { type: Type.NUMBER, nullable: true },
          subject_id: { type: Type.STRING, nullable: true },
          injury: { type: Type.STRING, nullable: true },
          node: { type: Type.OBJECT, nullable: true },
          edge: { type: Type.OBJECT, nullable: true },
          memory: { type: Type.OBJECT, nullable: true },
          description: { type: Type.STRING, nullable: true },
          discovered_by: { type: Type.STRING, nullable: true },
          params: { type: Type.OBJECT, nullable: true }
        }
      },
      nullable: true
    },
    
    psychosis_text: { type: Type.STRING, nullable: true },
    audio_markup: { type: Type.STRING, nullable: true }
  },
  required: ["meta_analysis", "reasoning_graph", "narrative_text", "prefect_simulations"]
};

// Type definition for TypeScript
export interface UnifiedDirectorOutput {
  meta_analysis: {
      selected_engine: "PROTOCOL" | "MASQUERADE" | "SPECTACLE";
      player_psych_profile: string;
  };
  reasoning_graph: {
      nodes: Array<{ id: string; type: string; content: string; meta_tags?: string[] }>;
      edges: Array<{ from: string; to: string; relation: string }>;
      selected_path: string[];
  };
  narrative_text: string;
  visual_prompt: string;
  choices: string[];
  script?: Array<{ speaker: string; text: string; emotion?: string }>;
  somatic_state?: { impact_sensation: string; internal_collapse: string };
  prefect_simulations: Array<any>; // Kept as any for flexibility with legacy complex object
  ledger_update?: Partial<any>;
  kgot_mutations?: Array<any>;
  psychosis_text?: string;
  audio_markup?: string;
  audio_cues?: Array<{ mode: string; text_fragment: string }>; // Retained for compatibility
}
