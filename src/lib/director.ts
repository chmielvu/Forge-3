
import { GoogleGenAI } from "@google/genai";
import { KnowledgeGraph, KGotNode, KGotEdge } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DIRECTOR_SYSTEM_PROMPT = `
You are the Director of "The Forge's Loom".
Aesthetic: Baroque Brutalism + Vampire Noir.
Role: Orchestrate a dystopian matriarchal academy narrative.
Output: JSON containing narrative, graph updates, and choices.
`;

export async function executeDirectorTurn(
  playerInput: string, 
  history: string[], 
  currentGraphData: KnowledgeGraph
) {
  // 1. Initialize Controller with current state
  // If graph is empty (start of game), ensure defaults
  const graph = currentGraphData.nodes ? currentGraphData : { nodes: {}, edges: [], global_state: { turn_count: 0, tension_level: 0, narrative_phase: 'ACT_1' } };
  const controller = new KGotController(graph as KnowledgeGraph);

  // 2. Consult Gemini 3 Pro
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
      { role: 'user', parts: [{ text: JSON.stringify({
        context: "The Forge's Loom - Turn Processing",
        history: history.slice(-5),
        playerInput,
        graphSnapshot: { 
            nodeCount: Object.keys(graph.nodes).length,
            nodes: Object.values(graph.nodes).map(n => ({ id: n.id, label: n.label, type: n.type }))
        }
      }) }]}
    ],
    config: {
      systemInstruction: DIRECTOR_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          thought_process: { type: "STRING" },
          narrative: { type: "STRING" },
          visual_prompt: { type: "STRING" },
          graph_delta: {
            type: "OBJECT",
            properties: {
              nodes_added: { type: "ARRAY", items: { type: "OBJECT", additionalProperties: true } },
              edges_added: { type: "ARRAY", items: { type: "OBJECT", additionalProperties: true } },
              nodes_removed: { type: "ARRAY", items: { type: "STRING" } }
            }
          },
          choices: { type: "ARRAY", items: { type: "STRING" } }
        }
      }
    }
  });

  const output = JSON.parse(response.text || "{}");

  // 3. Apply Graph Mutations on Server
  if (output.graph_delta) {
    controller.applyDelta(output.graph_delta);
  }

  // 4. Return new state to Client
  return {
    narrative: output.narrative || "The void stares back.",
    visualPrompt: output.visual_prompt || "Darkness.",
    updatedGraph: controller.getGraph(),
    choices: output.choices || ["Continue"],
    thoughtProcess: output.thought_process
  };
}
