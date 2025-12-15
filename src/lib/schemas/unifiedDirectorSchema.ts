
import { Type } from "@google/genai";

export const UnifiedDirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    thought_chain: { 
        type: Type.STRING, 
        description: "Brief reasoning: 1. Analyze Player State. 2. Select Tone. 3. Decide Outcome." 
    },
    narrative_prose: { 
        type: Type.STRING,
        description: "2-3 paragraphs of second-person ('You...') storytelling. Sensory focus."
    },
    visual_cue: { 
        type: Type.STRING,
        description: "A short description for the image generator (Camera Angle + Lighting + Subject Action)."
    },
    audio_cue: { 
        type: Type.STRING,
        description: "A description for the sound engine (Ambience + Specific SFX)."
    },
    state_update: {
      type: Type.OBJECT,
      properties: {
        trauma_delta: { type: Type.NUMBER, description: "-10 to +10" },
        hope_delta: { type: Type.NUMBER, description: "-10 to +10" },
        compliance_delta: { type: Type.NUMBER, description: "-10 to +10" }
      },
      required: ["trauma_delta", "hope_delta", "compliance_delta"]
    },
    choices: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 concise action options for the player (e.g., 'Resist', 'Beg', 'Observe')."
    },
    prefect_simulations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          prefect_id: { type: Type.STRING },
          prefect_name: { type: Type.STRING },
          public_action: { type: Type.STRING },
          public_actionSummary: { type: Type.STRING },
          hidden_motivation: { type: Type.STRING },
          emotional_state: {
            type: Type.OBJECT,
            properties: {
              paranoia: { type: Type.NUMBER },
              desperation: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              arousal: { type: Type.NUMBER },
              dominance: { type: Type.NUMBER }
            }
          },
          sabotage_attempt: {
            type: Type.OBJECT,
            properties: { target: { type: Type.STRING } }
          },
          alliance_signal: {
            type: Type.OBJECT,
            properties: { target: { type: Type.STRING } }
          },
          secrets_uncovered: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      }
    }
  },
  required: ["thought_chain", "narrative_prose", "visual_cue", "audio_cue", "state_update", "choices"]
};

export interface UnifiedDirectorOutput {
  thought_chain: string;
  narrative_prose: string;
  visual_cue: string;
  audio_cue: string;
  state_update: {
    trauma_delta: number;
    hope_delta: number;
    compliance_delta: number;
  };
  choices: string[];
  prefect_simulations?: Array<{
    prefect_id: string;
    prefect_name: string;
    public_action: string;
    public_actionSummary?: string;
    hidden_motivation: string;
    emotional_state: {
      paranoia: number;
      desperation: number;
      confidence: number;
      arousal?: number;
      dominance?: number;
    };
    sabotage_attempt?: { target: string };
    alliance_signal?: { target: string };
    secrets_uncovered?: string[];
  }>;
}
