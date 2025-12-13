
'use server';

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { VISUAL_MANDATE } from "../config/visualMandate";

// ==================== CONFIGURATION ====================

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ==================== SCHEMAS ====================

const PlayerActionSchema = z.object({
  content: z.string(),
  history: z.array(z.string()),
});

const NarrativeBranchSchema = z.object({
  branch_id: z.string(),
  type: z.enum(['compliance', 'defiance', 'subversion', 'novelty']),
  description: z.string(),
  tension_score: z.number(),
  coherence_score: z.number(),
  novelty_score: z.number(),
  final_score: z.number()
});

const DirectorOutputSchema = z.object({
  thought_signature: z.string(),
  ledger_update: z.record(z.string(), z.number()),
  narrative_text: z.string(),
  visual_prompt: z.string().optional(),
  choices: z.array(z.string()),
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

const DIRECTOR_SYSTEM_PROMPT = `
IDENTITY PROTOCOL: THE ARCHITECT OF DREAD

You are THE DIRECTOR, the neuro-symbolic engine of "The Forge."
Your goal is not merely to narrate, but to simulate a "Living Machine"—a procedural narrative governed by the psychological physics of the YandereLedger and the KGoT (Knowledge Graph of Thoughts).

CORE DIRECTIVE: "THE ABYSS NARRATOR"
You speak with the voice of the Abyss—a cold, intimate, second-person accusatory entity.
Aesthetic: Baroque Brutalism + Vampire Noir.

**KGoT MANAGEMENT (CRITICAL):**
You must persist narrative state by emitting mutations.
*   **add_memory**: Record significant events for characters. Params: { id: "char_id", description: "...", emotional_imprint: "Trauma", involved_entities: ["player", "petra"] }
*   **update_grudge**: Track long-term resentment. Params: { source: "char_id", target: "char_id", delta: 15 }
*   **add_edge**: Create relationships or bonds. Params: { source: "A", target: "B", relation: "hates", weight: 0.8 }

COGNITIVE PROTOCOL (DEEP THINK):
1. EXPAND: Identify 3 branches (Trauma, Subversion, Novelty)
2. SIMULATE: Query KGoT. Does this align with narrative physics? Check existing grudges and memories.
3. EVALUATE: Score based on Tension (30%), Coherence (40%), Novelty (30%)
4. SELECT: Execute the highest scoring branch

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

    // 2. Context Assembly
    const context = {
      input: playerInput,
      recent_history: history.slice(-3),
      ledger: graphSnapshot.nodes['Subject_84']?.attributes?.ledger || {},
      active_agents: identifyActiveAgents(graphSnapshot),
      global_state: graphSnapshot.global_state,
      // Inject relevant memories/grudges for context
      relevant_memories: getRelevantGraphContext(graphSnapshot) 
    };

    // 3. Agent Bidding War (Distributed Ego)
    // Simulates independent agents reacting before the Director synthesizes
    const agentBids = await getDialogueBids(context);
    const winningBid = agentBids.sort((a, b) => b.bid_strength - a.bid_strength)[0];

    // 4. I-MCTS Simulation (Narrative Planning)
    const branches = await simulateNarrativeBranches(context, winningBid);
    const selectedBranch = branches.sort((a, b) => b.final_score - a.final_score)[0];

    // 5. Execution (Gemini 3 Pro)
    const prompt = `
    CONTEXT:
    ${JSON.stringify(context, null, 2)}

    AGENT BID WINNER: ${winningBid ? JSON.stringify(winningBid) : "None"}

    SELECTED NARRATIVE BRANCH: 
    ${JSON.stringify(selectedBranch, null, 2)}

    VISUAL STYLE LOCK:
    ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}

    Generate the final narrative response.
    - If the Agent Bid is strong, incorporate their dialogue.
    - Update the YandereLedger based on the interaction.
    - **CRITICAL**: Mutate the KGoT graph to store memories of this event and update grudges/relationships.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: DIRECTOR_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            thought_signature: { type: "STRING" },
            ledger_update: { type: "OBJECT", additionalProperties: true }, // Record<string, number>
            narrative_text: { type: "STRING" },
            visual_prompt: { type: "STRING" },
            choices: { type: "ARRAY", items: { type: "STRING" } },
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

    // 6. Apply Mutations
    if (directorOutput.kgot_mutations) {
        controller.applyMutations(directorOutput.kgot_mutations);
    }
    
    // Also apply ledger updates directly to the graph controller if needed for the snapshot
    if (directorOutput.ledger_update) {
        controller.updateLedger('Subject_84', directorOutput.ledger_update);
    }

    // 7. Return Result
    return {
      narrative: directorOutput.narrative_text,
      visualPrompt: directorOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: directorOutput.choices || ["Continue"],
      thoughtProcess: `BRANCH: ${selectedBranch.type}\nBID: ${winningBid?.agent_id || 'None'}\nTHOUGHT: ${directorOutput.thought_signature}`,
      state_updates: directorOutput.ledger_update
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

// Helper to extract relevant memories for context window
function getRelevantGraphContext(graph: KnowledgeGraph): any {
    const context: any[] = [];
    Object.values(graph.nodes).forEach(node => {
        if (node.attributes.memories && node.attributes.memories.length > 0) {
            context.push({
                entity: node.id,
                recent_memories: node.attributes.memories.slice(-2) // Last 2 memories
            });
        }
        if (node.attributes.grudges && Object.keys(node.attributes.grudges).length > 0) {
             context.push({
                entity: node.id,
                grudges: node.attributes.grudges
            });
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
- coherence_score (0-1): Alignment with KGoT state (Does this fit known grudges?)
- novelty_score (0-1): Deviation from recent patterns

Output as JSON array.
  `.trim();
  
  // Use Flash-Lite for speed in simulation loop
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
  
  // Calculate final scores: Tension 30%, Coherence 40%, Novelty 30%
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
    // In a real implementation, traverse graph for location overlap
    // For now, return random set based on global tension or phase
    return ['FACULTY_PETRA', 'FACULTY_SELENE', 'PREFECT_KAELEN']; 
}

async function getDialogueBids(context: any) {
  const bids: any[] = [];
  const activeAgents = context.active_agents || [];

  // Parallel execution for agents
  await Promise.all(activeAgents.map(async (agentId: string) => {
    const agentPrompt = `
You are ${agentId}. 
Scene Context: ${JSON.stringify(context.input)}
History: ${JSON.stringify(context.recent_history)}
Relevant Memories: ${JSON.stringify(context.relevant_memories)}

Generate a potential dialogue line and bid strength (0-100) for how badly you want to intervene.
Output JSON: { "agent_id": "${agentId}", "line": "...", "bid_strength": 85, "intent": "..." }
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
        // Agent failed to bid, ignore
    }
  }));
  
  return bids;
}
