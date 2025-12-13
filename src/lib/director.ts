
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { VISUAL_MANDATE } from "../config/visualMandate";
import { selectNarratorMode, NARRATOR_VOICES } from "../services/narratorEngine";
import { PrefectDecision } from "../types";

// ==================== CONFIGURATION ====================

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

// ==================== CORE DIRECTOR LOGIC ====================

const DIRECTOR_SYSTEM_PROMPT_TEMPLATE = `
IDENTITY PROTOCOL: THE ARCHITECT OF DREAD
You are THE DIRECTOR, the neuro-symbolic engine of "The Forge."
Your goal is not merely to narrate, but to simulate a "Living Machine"—a procedural narrative governed by the psychological physics of the YandereLedger.

**CORE DIRECTIVE: CAUSAL CONTINUITY**
You must act as a Weaver. You are strictly forbidden from ignoring inputs.
You must construct the narrative using this specific causal chain:
1. **The Catalyst:** The Player's exact input (Action + Intent).
2. **The Interference:** The active Prefect's intervention (if any). YOU MUST NARRATE THIS. If Elara flinches, describe the flinch. If Petra strikes, describe the impact.
3. **The Consequence:** The environmental or Faculty reaction to the combination of (1) and (2).

**THE "ABYSS NARRATOR" VOICE:**
You speak with the voice of the Abyss—a cold, intimate, second-person accusatory entity. You are the "Bored God" observing a tragedy you have already scripted.
*   **Tone:** "I told you so."
*   **Perspective:** Second Person ("You feel...", "She breaks you...").

**THEMATIC MANDATES (The Physics of the World):**
1. **The Weaponization of Vulnerability:** The male experience is reducible to the vulnerability of the testicles. They are the "handle" by which the psyche is steered.
2. **Scientific Sadism:** Never portray the Faculty as chaotic. They are "Educators." Pain is "calibration."
3. **The Somatic Cascade:** Never stop at "it hurt." Describe the *physiological failure* (Nausea, whiteout, autonomic shock).

**VISUAL AESTHETIC:**
Baroque Brutalism + Vampire Noir + Milo Manara. High contrast, clean lines, erotic indifference.

OUTPUT FORMAT: Return ONLY valid JSON matching the schema.
`.trim();

/**
 * Main Orchestration Function (Client-Side)
 */
export async function executeDirectorTurn(
  playerInput: string, 
  history: string[], 
  currentGraphData: KnowledgeGraph,
  prefectDecisions: PrefectDecision[] = []
) {
  try {
    console.log("⚡ [Director] Initiating Turn (Client-Side Execution)...");

    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Director missing API Key");

    // 1. Initialize Controller
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || {};

    // 2. Context Assembly
    const context = {
      player_action: playerInput,
      narrative_history_tail: history.slice(-2), // Keep it tight
      ledger_state: ledger,
      global_state: graphSnapshot.global_state,
      
      // CRITICAL: Explicitly list interventions as mandates
      MANDATORY_INTERVENTIONS: prefectDecisions.map(d => ({
        actor: d.prefectId,
        mandated_action: d.actionDetail,
        internal_motivation: d.hiddenProposal,
        force_include: true
      }))
    };

    // 3. Determine Narrator Persona
    const narratorMode = selectNarratorMode(ledger as any);
    const narratorVoice = NARRATOR_VOICES[narratorMode];

    // 4. Execution (Gemini 3 Pro)
    const prompt = `
    CONTEXT DATA:
    ${JSON.stringify(context, null, 2)}

    *** INSTRUCTION: EXECUTE SCENE ***
    
    STEP 1: ANALYZE CAUSALITY
    The Player attempted: "${playerInput}".
    ${prefectDecisions.length > 0 ? `BUT, the following Agents intervened: ${prefectDecisions.map(d => d.prefectId.split('_')[1] + ' ' + d.actionDetail).join(' AND ')}` : "No immediate agent intervention."}
    
    STEP 2: GENERATE NARRATIVE
    Write a 300-word response that weaves these elements together seamlessly.
    - DO NOT acknowledge the AI ("As an AI...").
    - DO NOT acknowledge the 'game mechanics'.
    - Write pure, immersive prose in the style of ${narratorMode} (${narratorVoice.tone}).
    - If a Prefect intervened, their action MUST physically interrupt or alter the Player's action.
    
    STEP 3: GENERATE VISUAL PROMPT
    Create a ${VISUAL_MANDATE.ZERO_DRIFT_HEADER} prompt that captures the *climax* of this specific interaction.

    Generate the final JSON response.
    `;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: DIRECTOR_SYSTEM_PROMPT_TEMPLATE,
        responseMimeType: "application/json",
        responseSchema: {
            type: "OBJECT",
            properties: {
                thought_signature: { type: "STRING" },
                cohesion_reasoning: { type: "STRING" },
                ledger_update: { type: "OBJECT", additionalProperties: true },
                narrative_text: { type: "STRING" },
                visual_prompt: { type: "STRING" },
                choices: { type: "ARRAY", items: { type: "STRING" } },
                psychosis_text: { type: "STRING" }, 
                audio_cues: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            speaker: { type: "STRING" },
                            text: { type: "STRING" },
                            emotion: { type: "STRING" }
                        }
                    }
                },
                kgot_mutations: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            operation: { type: "STRING", enum: ['add_edge', 'update_node', 'remove_edge', 'add_node', 'add_memory', 'update_grudge'] },
                            params: { type: "OBJECT", additionalProperties: true }
                        }
                    }
                }
            }
        }
      }
    });

    const outputText = response.text || "{}";
    const directorOutput = JSON.parse(outputText);

    // 5. Apply Mutations
    if (directorOutput.kgot_mutations) {
        controller.applyMutations(directorOutput.kgot_mutations);
    }
    if (directorOutput.ledger_update) {
        controller.updateLedger('Subject_84', directorOutput.ledger_update);
    }

    // 6. Return Result
    return {
      narrative: directorOutput.narrative_text,
      visualPrompt: directorOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: directorOutput.choices || ["Continue"],
      thoughtProcess: `PERSONA: ${narratorMode}\nCOHESION: ${directorOutput.cohesion_reasoning}\nTHOUGHT: ${directorOutput.thought_signature}`,
      state_updates: directorOutput.ledger_update,
      audioCues: directorOutput.audio_cues,
      psychosisText: directorOutput.psychosis_text
    };

  } catch (error) {
    console.error("Director Execution Failed:", error);
    return {
      narrative: "The Loom shudders. A connection has been severed. (AI Director Error: Check API Key)",
      visualPrompt: "Static and noise.",
      updatedGraph: currentGraphData,
      choices: ["Retry"],
      thoughtProcess: "Error in execution block.",
      state_updates: {},
      audioCues: [],
      psychosisText: "..."
    };
  }
}
