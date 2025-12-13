
'use server';

import { z } from "zod";
import { executeDirectorTurn } from "@/lib/director";

// Validation Schema for the incoming form data
// We use z.any() for the graph to avoid complex recursive validation at the gateway,
// trusting the internal structure handling of the Director.
const TurnSchema = z.object({
  input: z.string().min(1).max(1000),
  history: z.array(z.string()),
  currentGraph: z.any() 
});

/**
 * Server Action: Process Player Turn
 * Handles the communication between the client form and the AI Director.
 * Orchestrates:
 * 1. Validation of player intent
 * 2. Execution of AI Director logic (Bidding, Simulation, Generation)
 * 3. Return of narrative, visual prompts, and audio cues for client-side rendering
 */
export async function submitTurn(prevState: any, formData: FormData) {
  // 1. Extract Raw Data
  const inputRaw = formData.get("input");
  const historyRaw = formData.get("history");
  const currentGraphRaw = formData.get("currentGraph");

  // 2. Pre-validation checks to prevent crashes
  if (!inputRaw || typeof inputRaw !== 'string') {
    return { 
      ...prevState,
      error: "Input is required." 
    };
  }

  // 3. Parse JSON strings (History and Graph are passed as hidden inputs)
  let history = [];
  let currentGraph = {};

  try {
    history = historyRaw && typeof historyRaw === 'string' ? JSON.parse(historyRaw) : [];
    currentGraph = currentGraphRaw && typeof currentGraphRaw === 'string' ? JSON.parse(currentGraphRaw) : {};
  } catch (e) {
    console.error("[ServerAction] JSON Parsing Failed:", e);
    return { 
      ...prevState,
      error: "Failed to parse game state." 
    };
  }

  // 4. Validate Structured Data
  const validated = TurnSchema.safeParse({
    input: inputRaw,
    history,
    currentGraph
  });

  if (!validated.success) {
    console.error("[ServerAction] Validation Failed:", validated.error);
    return { 
      ...prevState,
      error: "Invalid input data." 
    };
  }

  // 5. Execute Director Logic
  try {
    const result = await executeDirectorTurn(
      validated.data.input,
      validated.data.history,
      validated.data.currentGraph
    );
    
    // 6. Return Serializable Result to Client
    // This payload drives the MediaController on the client to generate actual assets
    return {
      narrative: result.narrative,
      visualPrompt: result.visualPrompt,
      updatedGraph: result.updatedGraph,
      choices: result.choices,
      thoughtProcess: result.thoughtProcess,
      state_updates: result.state_updates,
      audioCues: result.audioCues // Passed to client for potential specific TTS cues
    };

  } catch (e) {
    console.error("[ServerAction] Director Execution Failed:", e);
    return { 
      ...prevState,
      error: "The Director encountered a critical error processing your reality." 
    };
  }
}
