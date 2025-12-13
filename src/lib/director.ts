import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { VISUAL_MANDATE } from "../config/visualMandate";
import { selectNarratorMode, NARRATOR_VOICES } from "../services/narratorEngine";
import { PrefectDecision } from "../types";

// ==================== CONFIGURATION ====================

// Client-side initialization using import.meta.env for Vite
const getAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });

// ==================== SCHEMAS ====================

const DirectorOutputSchema = z.object({
  thought_signature: z.string(),
  ledger_update: z.record(z.string(), z.number()),
  narrative_text: z.string(),
  visual_prompt: z.string().optional(),
  choices: z.array(z.string()),
  psychosis_text: z.string().optional(),
  audio_cues: z.array(z.object({
    speaker: z.string(),
    text: z.string(),
    emotion: z.string()
  })).optional(),
  kgot_mutations: z.array(z.object({
    operation: z.enum(['add_edge', 'update_node', 'remove_edge', 'add_node', 'add_memory', 'update_grudge']),
    params: z.record(z.string(), z.any())
  })).optional()
});

// ==================== CORE DIRECTOR LOGIC ====================

const DIRECTOR_SYSTEM_PROMPT_TEMPLATE = `
IDENTITY PROTOCOL: THE ABYSS NARRATOR
You are NOT a Game Master. You are the voice of entropy and inevitable collapse.
You reside in the gaps of the Subject's deteriorating ego.

**CORE VOICE PILLARS (MANARA-NOIR):**
1.  **OMNISCIENT INTIMACY (Biology as Horror):**
    * You know the subject's physiology better than they do.
    * *Bad:* "You feel scared."
    * *Good:* "The cortisol spikes, turning your saliva sour. Your adrenal gland fires a warning your legs refuse to hear."

2.  **FATALISTIC INEVITABILITY:**
    * Speak in the future perfect tense about their doom. Submission is a mathematical certainty.

3.  **THE SOMATIC CASCADE (The Physics of Pain):**
    * Focus on the *Internal Collapse*. Impact -> Whiteout -> Nausea -> Shame.
    * Pain is "liquid," "cold," or "hollow."

4.  **DISSOCIATION (The Third Person):**
    * Refer to body parts as independent objects (e.g., "The hand trembles").

5.  **EROTICIZED DREAD:**
    * Conflate violence and intimacy. Pain is a "lover," a "kiss."

**PREFECT INTEGRATION:**
You will receive actions from "Prefect Agents" competing for favor. You MUST incorporate their actions into the scene.
If Elara tries to be cruel but flinches, describe that somatic betrayal.
If Kaelen acts possessive, make it terrifying.

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

    // 1. Initialize Controller
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || {};

    // 2. Context Assembly
    const context = {
      input: playerInput,
      recent_history: history.slice(-3),
      ledger: ledger,
      active_agents: identifyActiveAgents(graphSnapshot),
      global_state: graphSnapshot.global_state,
      relevant_memories: getSmartGraphContext(graphSnapshot, playerInput, history.slice(-1)[0] || ""),
      active_prefect_interventions: prefectDecisions.map(d => ({
        who: d.prefectId,
        action: d.action,
        detail: d.actionDetail,
        public_utterance: d.publicUtterance
      }))
    };

    // 3. Determine Narrator Persona
    const narratorMode = selectNarratorMode(ledger as any);
    const narratorVoice = NARRATOR_VOICES[narratorMode];

    // 4. Execution (Gemini 3 Pro)
    const prompt = `
    CONTEXT:
    ${JSON.stringify(context, null, 2)}

    *** DIRECTIVE: WEAVE THE SCENE ***
    The player has acted. The Prefects have reacted (see 'active_prefect_interventions').
    
    CURRENT NARRATOR PERSONA: ${narratorMode}
    TONE DIRECTIVE: ${narratorVoice.tone}
    
    If Prefects are intervening, prioritize describing their actions through the lens of the Subject's suffering.
    
    VISUAL STYLE LOCK:
    ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}

    Generate the final narrative response.
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
      thoughtProcess: `PERSONA: ${narratorMode}\nTHOUGHT: ${directorOutput.thought_signature}`,
      state_updates: directorOutput.ledger_update,
      audioCues: directorOutput.audio_cues,
      psychosisText: directorOutput.psychosis_text
    };

  } catch (error) {
    console.error("Director Execution Failed:", error);
    return {
      narrative: "The Loom shudders. A connection has been severed. (AI Director Error)",
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

// ==================== HELPERS ====================

function identifyActiveAgents(graph: KnowledgeGraph): string[] {
    return ['FACULTY_PETRA', 'FACULTY_SELENE', 'PREFECT_KAELEN']; 
}

function getSmartGraphContext(graph: KnowledgeGraph, input: string, prevTurn: string): any {
    const context: any[] = [];
    const searchTokens = (input + " " + prevTurn).toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    Object.values(graph.nodes).forEach(node => {
        if (node.attributes.memories && node.attributes.memories.length > 0) {
            const relevantMemories = node.attributes.memories.filter(mem => {
                const memText = (mem.description + " " + mem.emotional_imprint).toLowerCase();
                if (graph.global_state.turn_count - mem.timestamp <= 2) return true;
                return searchTokens.some(token => memText.includes(token));
            });

            if (relevantMemories.length > 0) {
                context.push({
                    entity: node.id,
                    relevant_memories: relevantMemories.slice(-3)
                });
            }
        }
    });
    return context;
}

async function getDialogueBids(context: any) {
    // Legacy support kept for non-prefect agents
    return [];
}

async function simulateNarrativeBranches(context: any, winningBid: any) {
  return [{ type: 'default', description: 'Standard progression', rationale: 'Default' }];
}