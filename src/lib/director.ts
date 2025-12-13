
import { GoogleGenAI, Type } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { VISUAL_MANDATE } from "../config/visualMandate";
import { selectNarratorMode, NARRATOR_VOICES } from "../services/narratorEngine";
import { PrefectDecision } from "../types";
import { SYSTEM_INSTRUCTION_ROOT } from "../config/loreInjection";

// ==================== CONFIGURATION ====================

// Robust API Key Retrieval
const getApiKey = (): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {}
  return '';
};

const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

// ==================== SCHEMAS ====================

// Strict output schema to force the LLM to be a "State Machine" not just a chatbot.
const DirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    thought_signature: { type: Type.STRING, description: "Internal reasoning regarding themes and pacing." },
    narrative_text: { type: Type.STRING, description: "The prose output, adhering to Manara-Noir aesthetic." },
    visual_prompt: { type: Type.STRING, description: "JSON describing the scene for the image generator." },
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
          operation: { type: Type.STRING, enum: ['add_edge', 'update_node', 'add_memory', 'update_grudge'] },
          params: { 
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, nullable: true },
                type: { type: Type.STRING, nullable: true },
                label: { type: Type.STRING, nullable: true },
                source: { type: Type.STRING, nullable: true },
                target: { type: Type.STRING, nullable: true },
                relation: { type: Type.STRING, nullable: true },
                weight: { type: Type.NUMBER, nullable: true },
                delta: { type: Type.NUMBER, nullable: true },
                description: { type: Type.STRING, nullable: true },
                emotional_imprint: { type: Type.STRING, nullable: true },
                involved_entities: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                // Flatten common attributes to avoid nested object issues in strict mode
                manara_gaze: { type: Type.STRING, nullable: true },
                description_abyss: { type: Type.STRING, nullable: true }
            },
            nullable: true
          } 
        }
      },
      nullable: true
    },
    audio_cues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          emotion: { type: Type.STRING }
        }
      },
      nullable: true
    },
    psychosis_text: { type: Type.STRING, nullable: true }
  },
  required: ["thought_signature", "narrative_text", "visual_prompt", "choices"]
};

// ==================== CORE LOGIC ====================

/**
 * Main Orchestration Function (Client-Side)
 * Executes the "Introspective MCTS" loop simulated via Gemini 3 Pro.
 */
export async function executeDirectorTurn(
  playerInput: string, 
  history: string[], 
  currentGraphData: KnowledgeGraph,
  prefectDecisions: PrefectDecision[] = []
) {
  try {
    console.log("⚡ [Director] Initiating Neuro-Symbolic Turn...");

    // 1. Initialize Controller & Snapshot
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || {};

    // 2. Context Assembly (The World State)
    const context = {
      input: playerInput,
      recent_history: history.slice(-3),
      ledger_state: ledger,
      global_turn: graphSnapshot.global_state.turn_count,
      active_agents: ['FACULTY_SELENE', 'FACULTY_PETRA', 'PREFECT_ELARA'], // Dynamic in full version
      prefect_interventions: prefectDecisions.map(d => ({
        agent: d.prefectId,
        intent: d.hiddenProposal,
        action: d.actionDetail,
        target: d.targetId
      }))
    };

    // 3. Determine Narrator Persona (The Voice)
    const narratorMode = selectNarratorMode(ledger as any);
    const narratorVoice = NARRATOR_VOICES[narratorMode];

    // 4. Construct the "Deep Think" Prompt
    const prompt = `
    ${SYSTEM_INSTRUCTION_ROOT}

    *** CURRENT STATE MATRIX ***
    ${JSON.stringify(context, null, 2)}

    *** NARRATOR MODE ACTIVE: ${narratorMode} ***
    Tone Mandate: ${narratorVoice.tone}

    *** INSTRUCTION ***
    1. Analyze the Player's Input.
    2. Review 'prefect_interventions'. If Prefects are fighting (e.g. Sabotage), describe the friction. If they align, describe the overwhelming force.
    3. Determine the 'Somatic Cascade' (Physics of Pain) if violence occurred.
    4. Update the Ledger (Psychometrics) based on the input.
    5. Generate the Narrative. It must be immersive, sensory, and strictly adhere to the 'Baroque Brutalism' aesthetic.
    
    *** VISUAL DIRECTIVE ***
    Construct a prompt for the visual engine that adheres to:
    ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}
    `;

    // 5. Execution (Gemini 3 Pro)
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: DirectorOutputSchema,
        temperature: 1.0, // High temperature for creative prose
      }
    });

    const outputText = response.text || "{}";
    const directorOutput = JSON.parse(outputText);

    // 6. Apply Mutations (State Evolution)
    if (directorOutput.kgot_mutations) {
        // Map flattened schema params back to controller structure if necessary
        const mutations = directorOutput.kgot_mutations.map((m: any) => {
            if (m.operation === 'update_node' && m.params) {
                // Reconstruct attributes object from flattened params
                const attributes: any = {};
                if (m.params.manara_gaze) attributes.manara_gaze = m.params.manara_gaze;
                if (m.params.description_abyss) attributes.description_abyss = m.params.description_abyss;
                return { 
                    ...m, 
                    params: { ...m.params, attributes } 
                };
            }
            return m;
        });
        controller.applyMutations(mutations);
    }
    if (directorOutput.ledger_update) {
        controller.updateLedger('Subject_84', directorOutput.ledger_update);
    }

    // 7. Return Result to Store
    return {
      narrative: directorOutput.narrative_text,
      visualPrompt: directorOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: directorOutput.choices || ["Endure", "Observe", "Submit"],
      thoughtProcess: `PERSONA: ${narratorMode}\nSIG: ${directorOutput.thought_signature}`,
      state_updates: directorOutput.ledger_update,
      audioCues: directorOutput.audio_cues,
      psychosisText: directorOutput.psychosis_text // Optional hallucination layer
    };

  } catch (error) {
    console.error("Director Execution Failed:", error);
    return {
      narrative: "The Loom shudders. A connection has been severed. The Faculty pauses, frozen in time. (AI Generation Error - Check API Key or Quota)",
      visualPrompt: "Static and noise, glitch art.",
      updatedGraph: currentGraphData,
      choices: ["Retry Connection"],
      thoughtProcess: "Error in execution block.",
      state_updates: {},
      audioCues: [],
      psychosisText: "..."
    };
  }
}
