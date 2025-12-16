

import { Type } from "@google/genai";

export interface UnifiedDirectorOutput {
  meta_analysis: {
    selected_engine: string;
    player_psych_profile: string;
  };
  reasoning_graph: {
    nodes: Array<{ id: string; type: string; content: string }>;
    selected_path: string[];
  };
  narrative_text: string;
  visual_prompt?: string;
  choices: string[];
  ledger_update?: {
    trauma_delta?: number;
    shame_delta?: number;
    compliance_delta?: number;
    hope_delta?: number;
  };
  kgot_mutations?: any[]; 
  prefect_simulations?: Array<{
      prefect_id: string;
      prefect_name: string;
      emotional_state: {
          paranoia: number;
          desperation: number;
          confidence: number;
          arousal?: number;
          dominance?: number;
      };
      public_action: string;
      public_actionSummary?: string;
      hidden_motivation: string;
      sabotage_attempt?: { target: string; method: string; deniability: number };
      alliance_signal?: { target: string; message: string };
      secrets_uncovered?: string[];
  }>;
  somatic_state?: {
    impact_sensation?: string;
    internal_collapse?: string;
  };
  script?: Array<{ speaker: string; text: string; emotion?: string; }>;
}

export const UnifiedDirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    meta_analysis: {
      type: Type.OBJECT,
      properties: {
        selected_engine: { type: Type.STRING },
        player_psych_profile: { type: Type.STRING }
      },
      required: ["selected_engine", "player_psych_profile"]
    },
    reasoning_graph: {
      type: Type.OBJECT,
      description: "The AGoT Plan. Nodes = Events/Thoughts.",
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING }, // FABULA, PREFECT, MERGE
              content: { type: Type.STRING }
            }
          }
        },
        selected_path: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["nodes", "selected_path"]
    },
    narrative_text: { 
      type: Type.STRING,
      description: "The final prose. Must follow Voice Vectors and Safety Rules."
    },
    visual_prompt: { type: Type.STRING },
    choices: { type: Type.ARRAY, items: { type: Type.STRING } },
    
    // State Updates (Simplified)
    ledger_update: { 
        type: Type.OBJECT,
        properties: {
            trauma_delta: { type: Type.NUMBER },
            shame_delta: { type: Type.NUMBER },
            compliance_delta: { type: Type.NUMBER },
            hope_delta: { type: Type.NUMBER }
        }
    },
    // Optional Advanced Fields
    kgot_mutations: { 
        type: Type.ARRAY,
        items: { 
            type: Type.OBJECT,
            properties: {
                operation: { type: Type.STRING },
                id: { type: Type.STRING },
                params: { 
                    type: Type.OBJECT, 
                    properties: {
                        target_id: { type: Type.STRING, description: "The ID of the target entity for the operation." },
                        injury_name: { type: Type.STRING, description: "The name of the injury." },
                        injury: { type: Type.STRING, description: "Alias for injury_name." },
                        subject_id: { type: Type.STRING, description: "The ID of the subject." },
                        secret_name: { type: Type.STRING, description: "The name of the secret." },
                        description: { type: Type.STRING, description: "A general description." },
                        severity: { type: Type.NUMBER, description: "The severity of the effect." },
                    },
                    additionalProperties: true 
                },
                edge: { 
                    type: Type.OBJECT, 
                    properties: {
                        source: { type: Type.STRING },
                        target: { type: Type.STRING },
                        type: { type: Type.STRING },
                        label: { type: Type.STRING },
                        weight: { type: Type.NUMBER },
                        key: { type: Type.STRING },
                    },
                    additionalProperties: true
                },
                node: { 
                    type: Type.OBJECT, 
                    properties: {
                        id: { type: Type.STRING },
                        type: { type: Type.STRING },
                        label: { type: Type.STRING },
                        attributes: { type: Type.OBJECT, properties: { _placeholder: { type: Type.STRING, description: "Placeholder for dynamic attributes."} }, additionalProperties: true }
                    },
                    additionalProperties: true
                },
                updates: { 
                    type: Type.OBJECT, 
                    properties: {
                        attributes: { type: Type.OBJECT, properties: { _placeholder: { type: Type.STRING, description: "Placeholder for dynamic attributes."} }, additionalProperties: true }
                    },
                    additionalProperties: true
                },
                memory: { 
                    type: Type.OBJECT, 
                    properties: {
                        id: { type: Type.STRING },
                        description: { type: Type.STRING },
                        emotional_imprint: { type: Type.STRING },
                        involved_entities: { type: Type.ARRAY, items: { type: Type.STRING } },
                        timestamp: { type: Type.NUMBER }
                    },
                    additionalProperties: true
                },
                secret_id: { type: Type.STRING },
                description: { type: Type.STRING },
                discovered_by: { type: Type.STRING },
                turn_discovered: { type: Type.NUMBER },
                target_id: { type: Type.STRING },
                subject_id: { type: Type.STRING },
                injury: { type: Type.STRING },
                severity: { type: Type.NUMBER },
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                delta: { type: Type.NUMBER },
                category: { type: Type.STRING },
            },
            additionalProperties: true // Allow for properties not explicitly defined
        },
        description: "List of graph mutations to apply."
    },
    prefect_simulations: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                prefect_id: { type: Type.STRING },
                prefect_name: { type: Type.STRING },
                emotional_state: { 
                    type: Type.OBJECT,
                    properties: {
                        paranoia: { type: Type.NUMBER },
                        desperation: { type: Type.NUMBER },
                        confidence: { type: Type.NUMBER },
                        arousal: { type: Type.NUMBER },
                        dominance: { type: Type.NUMBER }
                    },
                    required: ["paranoia", "desperation", "confidence"]
                },
                public_action: { type: Type.STRING },
                public_actionSummary: { type: Type.STRING },
                hidden_motivation: { type: Type.STRING },
                sabotage_attempt: { 
                    type: Type.OBJECT,
                    properties: { target: { type: Type.STRING }, method: { type: Type.STRING } }
                },
                alliance_signal: {
                     type: Type.OBJECT,
                    properties: { target: { type: Type.STRING }, message: { type: Type.STRING } }
                },
                secrets_uncovered: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["prefect_id", "public_action", "hidden_motivation", "emotional_state"]
        }
    },
    somatic_state: {
        type: Type.OBJECT,
        properties: {
            impact_sensation: { type: Type.STRING },
            internal_collapse: { type: Type.STRING }
        }
    },
    script: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                speaker: { type: Type.STRING },
                text: { type: Type.STRING },
                emotion: { type: Type.STRING }
            },
            required: ["speaker", "text"]
        }
    }
  },
  required: ["meta_analysis", "reasoning_graph", "narrative_text", "choices"]
};