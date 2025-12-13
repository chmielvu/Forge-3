
import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SYSTEM_INSTRUCTION, DIRECTOR_MANDATE_PROMPT } from "../constants";
import { DirectorOutput, DirectorResponse, GameState } from "../types";
import { orchestrator } from "../agents/AgentOrchestrator";
import { directorAI } from "../agents/DirectorAI";

// Initialize client with strict process.env access
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateNextTurn = async (
  history: string[], 
  currentState: GameState, 
  action: string
): Promise<DirectorOutput> => {
  
  try {
    // 1. EXECUTE SIMULATION (Agents: Prefects, Mara, Faculty)
    // This runs the "Simulated Reality" layer
    const simulation = await orchestrator.generateTurn(currentState, action);

    // 2. DIRECTOR ORCHESTRATION (Gemini 3 Pro)
    // The Director adjudicates the simulation results against the global narrative
    const directorResponse = await directorAI.executeTurn(currentState, simulation, action, history);

    // 3. MAP RESPONSE TO UI
    // Extract specific visual prompt if available
    let visualPrompt = "Dark erotic academia scene, baroque brutalism, chiaroscuro";
    if (directorResponse.visualAudioAssets && directorResponse.visualAudioAssets.length > 0) {
      // Safely stringify if it's an object, or use as is
      const vp = directorResponse.visualAudioAssets[0].visualPrompt;
      visualPrompt = typeof vp === 'string' ? vp : JSON.stringify(vp);
    }

    return {
      thought_process: directorResponse.debugTrace || "Director planning complete.",
      narrative: directorResponse.publicRender,
      visual_prompt: visualPrompt,
      state_updates: directorResponse.ledgerDelta,
      graph_updates: {
          edges_added: directorResponse.graphDelta?.edges_added || [],
          edges_removed: directorResponse.graphDelta?.edges_removed || []
      },
      choices: directorResponse.choices || ["Continue."],
      
      // Pass through debug info
      simulationLog: simulation.simulationLog,
      debugTrace: directorResponse.debugTrace || null
    };

  } catch (error) {
    console.error("Game Loop Error:", error);
    return {
      thought_process: "System Failure.",
      narrative: "The simulation fractures. The stone walls dissolve into bleeding code. You feel a profound sense of wrongness, as if the universe itself has rejected your choice. Try again.",
      visual_prompt: "Abstract digital horror, bleeding pixels, red and black static.",
      choices: ["Stabilize consciousness.", "Reboot system."],
      state_updates: {},
      simulationLog: `CRITICAL ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
      debugTrace: "System crash during generateNextTurn"
    };
  }
};

export const analyzeArcaneRelic = async (
  imageB64: string,
  currentState: GameState
): Promise<string> => {
  const analysisPrompt = `
    ROLE-PLAYING MANDATE: 
    You are Doctor Lysandra, the Logician of The Forge. 
    CONTEXT: Current Psychometric Readout: ${JSON.stringify(currentState.ledger)}
    TASK: Analyze this image. Identify symbolic content, psychological tells, and provide a conclusion.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: imageB64,
                mimeType: 'image/jpeg',
              },
            },
            { text: analysisPrompt },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
    });
    return response.text || "Analysis failed.";
  } catch (e) {
    console.error("Analysis Failed:", e);
    return "Scanner malfunction.";
  }
};