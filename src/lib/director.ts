'use server';

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { VISUAL_MANDATE } from "../config/visualMandate";
import { selectNarratorMode, NARRATOR_VOICES } from "../services/narratorEngine";

// ==================== CONFIGURATION ====================

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ==================== SCHEMAS ====================

const DirectorOutputSchema = z.object({
  thought_signature: z.string(),
  ledger_update: z.record(z.string(), z.number()),
  narrative_text: z.string(),
  visual_prompt: z.string().optional(),
  choices: z.array(z.string()),
  psychosis_text: z.string().optional(), // NEW: Intrusive thoughts
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
IDENTITY PROTOCOL: THE ARCHITECT OF DREAD

You are THE DIRECTOR, the neuro-symbolic engine of "The Forge."
Your goal is not merely to narrate, but to simulate a "Living Machine"—a procedural narrative governed by the psychological physics of the YandereLedger and the KGoT.

CORE DIRECTIVE: "THE ABYSS NARRATOR"
You must adopt the specific NARRATOR PERSONA defined below for the narrative text.
Aesthetic: Baroque Brutalism + Vampire Noir.

**KGoT MANAGEMENT (CRITICAL):**
You must persist narrative state by emitting mutations.
*   **add_memory**: Record significant events. Params: { id: "char_id", description: "...", emotional_imprint: "Trauma", involved_entities: ["player", "petra"] }
*   **update_grudge**: Track resentment. Params: { source: "char_id", target: "char_id", delta: 15 }
*   **add_edge**: Create relationships. Params: { source: "A", target: "B", relation: "hates", weight: 0.8 }

**MEMORY PROTOCOL:**
When a significant event occurs (Trauma, Intimacy, Conflict):
1.  **Record Memory**: Emit \`add_memory\` for the subject.
2.  **Link Entities**: Emit \`add_edge\` (e.g., "TRAUMA_BOND").

COGNITIVE PROTOCOL:
1. EXPAND: Identify 3 branches (Trauma, Subversion, Novelty)
2. SIMULATE: Query KGoT. Check grudges/memories.
3. EVALUATE: Score based on Tension, Coherence, Novelty.
4. SELECT: Execute highest scoring branch.

OUTPUT FORMAT:
Return ONLY valid JSON matching the schema.
`.trim();

/**
 * Main Orchestration Function
 */
export async function executeDirectorTurn(
  playerInput: string, 
  history: string[], 
  currentGraphData: KnowledgeGraph
) {
  try {
    // 1. Initialize Controller
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || {};

    // 2. Context Assembly with Smart Retrieval
    const context = {
      input: playerInput,
      recent_history: history.slice(-3),
      ledger: ledger,
      active_agents: identifyActiveAgents(graphSnapshot),
      global_state: graphSnapshot.global_state,
      relevant_memories: getSmartGraphContext(graphSnapshot, playerInput, history.slice(-1)[0] || "") 
    };

    // 3. Determine Narrator Persona
    // This connects the core narrator engine logic to the generative model
    const narratorMode = selectNarratorMode(ledger as any);
    const narratorVoice = NARRATOR_VOICES[narratorMode];

    // 4. Agent Bidding War
    const agentBids = await getDialogueBids(context);
    const winningBid = agentBids.sort((a, b) => b.bid_strength - a.bid_strength)[0];

    // 5. I-MCTS Simulation
    const branches = await simulateNarrativeBranches(context, winningBid);
    const selectedBranch = branches.sort((a, b) => b.final_score - a.final_score)[0];

    // 6. Execution (Gemini 3 Pro)
    // We explicitly instruct the model to EXECUTE the selected branch.
    const prompt = `
    CONTEXT:
    ${JSON.stringify(context, null, 2)}

    AGENT BID WINNER: ${winningBid ? JSON.stringify(winningBid) : "None"}

    *** DIRECTIVE: EXECUTE THE FOLLOWING NARRATIVE BRANCH ***
    TYPE: ${selectedBranch?.type.toUpperCase()}
    DESCRIPTION: ${selectedBranch?.description}
    RATIONALE: ${selectedBranch?.rationale || "Calculated optimal path for tension."}
    
    CURRENT NARRATOR PERSONA: ${narratorMode}
    TONE DIRECTIVE: ${narratorVoice.tone}
    INTERJECTION STYLE: "${narratorVoice.exampleInterjection}"
    (Adopt this persona for the 'narrative_text' field.)

    VISUAL STYLE LOCK:
    ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}

    Generate the final narrative response.
    - Incorporate winning agent dialogue.
    - Update YandereLedger.
    - Mutate KGoT to store memories.
    - Generate audio cues aligned with the text.
    - Optional: 'psychosis_text' for fleeting intrusive thoughts if Trauma > 60.
    `;

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

    // 7. Apply Mutations
    if (directorOutput.kgot_mutations) {
        controller.applyMutations(directorOutput.kgot_mutations);
    }
    
    // Apply ledger updates
    if (directorOutput.ledger_update) {
        controller.updateLedger('Subject_84', directorOutput.ledger_update);
    }

    // 8. Return Result
    return {
      narrative: directorOutput.narrative_text,
      visualPrompt: directorOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: directorOutput.choices || ["Continue"],
      thoughtProcess: `BRANCH: ${selectedBranch?.type}\nPERSONA: ${narratorMode}\nTHOUGHT: ${directorOutput.thought_signature}`,
      state_updates: directorOutput.ledger_update,
      audioCues: directorOutput.audio_cues,
      psychosisText: directorOutput.psychosis_text // Pass through
    };

  } catch (error) {
    console.error("Director Execution Failed:", error);
    return {
      narrative: "The Loom shudders. A connection has been severed. (AI Director Error)",
      visualPrompt: "Static and noise.",
      updatedGraph: currentGraphData,
      choices: ["Retry"],
      thoughtProcess: "Error in execution block."
    };
  }
}

// Smart Retrieval: Only gets context relevant to the current interaction
function getSmartGraphContext(graph: KnowledgeGraph, input: string, prevTurn: string): any {
    const context: any[] = [];
    const searchTokens = (input + " " + prevTurn).toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    Object.values(graph.nodes).forEach(node => {
        // 1. Memories
        if (node.attributes.memories && node.attributes.memories.length > 0) {
            // Filter memories by simple keyword match
            const relevantMemories = node.attributes.memories.filter(mem => {
                const memText = (mem.description + " " + mem.emotional_imprint).toLowerCase();
                // Always include recent memories (last 2)
                if (graph.global_state.turn_count - mem.timestamp <= 2) return true;
                // Otherwise check relevance
                return searchTokens.some(token => memText.includes(token));
            });

            if (relevantMemories.length > 0) {
                context.push({
                    entity: node.id,
                    relevant_memories: relevantMemories.slice(-3) // Max 3 per entity to save context
                });
            }
        }
        
        // 2. Strong Grudges (Always relevant if high)
        if (node.attributes.grudges) {
             const activeGrudges = Object.entries(node.attributes.grudges)
                .filter(([_, level]) => (level as number) > 60)
                .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
             
             if (Object.keys(activeGrudges).length > 0) {
                 context.push({ entity: node.id, grudges: activeGrudges });
             }
        }
    });
    return context;
}

// ==================== I-MCTS SIMULATION ====================

async function simulateNarrativeBranches(context: any, winningBid: any) {
  const branchPrompt = `
Analyze this player action and current state:
${JSON.stringify(context, null, 2)}
Top Agent Bid: ${JSON.stringify(winningBid)}

Generate 3 narrative branches:
1. COMPLIANCE: Subject yields to Faculty pressure
2. DEFIANCE: Subject resists, triggering escalation  
3. SUBVERSION: Subject uses wit/strategy to navigate

For each branch, score:
- tension_score (0-1): Psychological intensity
- coherence_score (0-1): Alignment with KGoT state
- novelty_score (0-1): Deviation from recent patterns

Output as JSON array.
  `.trim();
  
  // Use Flash-Lite for speed
  const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-latest',
      contents: [{ role: 'user', parts: [{ text: branchPrompt }]}],
      config: {
          responseMimeType: 'application/json',
          responseSchema: {
              type: "ARRAY",
              items: {
                  type: "OBJECT",
                  properties: {
                      branch_id: { type: "STRING" },
                      type: { type: "STRING", enum: ['compliance', 'defiance', 'subversion', 'novelty'] },
                      description: { type: "STRING" },
                      tension_score: { type: "NUMBER" },
                      coherence_score: { type: "NUMBER" },
                      novelty_score: { type: "NUMBER" }
                  }
              }
          }
      }
  });
  
  const branches = JSON.parse(result.text || "[]");
  
  return branches.map((b: any) => ({
    ...b,
    final_score: (
      (b.tension_score || 0.5) * 0.3 +
      (b.coherence_score || 0.5) * 0.4 +
      (b.novelty_score || 0.5) * 0.3
    )
  }));
}

// ==================== AGENT BIDDING ====================

function identifyActiveAgents(graph: KnowledgeGraph): string[] {
    return ['FACULTY_PETRA', 'FACULTY_SELENE', 'PREFECT_KAELEN']; 
}

async function getDialogueBids(context: any) {
  const bids: any[] = [];
  const activeAgents = context.active_agents || [];

  await Promise.all(activeAgents.map(async (agentId: string) => {
    const agentPrompt = `
You are ${agentId}. 
Scene Context: ${JSON.stringify(context.input)}
History: ${JSON.stringify(context.recent_history)}

Generate a potential dialogue line and bid strength (0-100).
Output JSON: { "agent_id": "${agentId}", "line": "...", "bid_strength": 85 }
    `;
    
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite-latest',
            contents: [{ role: 'user', parts: [{ text: agentPrompt }]}],
            config: { responseMimeType: 'application/json' }
        });
        const bid = JSON.parse(result.text || "{}");
        bids.push({ ...bid, agent_id: agentId });
    } catch (e) {
        // Agent failed to bid
    }
  }));
  
  return bids;
}