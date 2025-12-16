import { GoogleGenAI, Type } from "@google/genai";
import { KGotController } from "@/controllers/KGotController";
import { DIRECTOR_SYSTEM_INSTRUCTIONS } from "@/config/directorCore";
import { LORE_APPENDIX, LORE_CONSTITUTION } from "@/config/loreInjection"; 
import { THEMATIC_ENGINES, MOTIF_LIBRARY } from "@/config/directorEngines";
import { UnifiedDirectorOutputSchema } from "@/lib/schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger } from "../types";
import { INITIAL_LEDGER } from "@/constants";
import { callGeminiWithRetry } from "../utils/apiRetry";
import { TensionManager } from "../services/TensionManager";
import { localMediaService, localGrunt } from "../services/localMediaService";

const getApiKey = (): string => {
  if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) return (import.meta as any).env.VITE_GEMINI_API_KEY;
  return '';
};

// Initialize the new GenAI Client
const ai = new GoogleGenAI({ apiKey: getApiKey() });

function buildPrefectContextBlock(activePrefects: PrefectDNA[]): string {
  return activePrefects.map((prefect, idx) => `
    **Prefect ${idx + 1}: ${prefect.displayName} (${prefect.archetype})**
    - Drive: ${prefect.secretWeakness ? `Exploit weakness: ${prefect.secretWeakness}` : 'Enforce Protocol'}
    - State: Paranoia=${prefect.currentEmotionalState?.paranoia.toFixed(2) || 0.2}
  `).join('\n');
}

export async function executeUnifiedDirectorTurn(
  playerInput: string,
  history: string[],
  currentGraphData: any, // Using any here to accept the raw graph object from store
  activePrefects: PrefectDNA[],
  isLiteMode: boolean = false,
  modelId: string = 'gemini-2.5-flash-lite'
): Promise<any> { 
  
  // Re-instantiate controller with passed graph data
  const controller = new KGotController(currentGraphData);
  const graphSnapshot = controller.getGraph();
  const ledger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || INITIAL_LEDGER;
  const currentLocation = graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || 'The Calibration Chamber';
  const narrativeBeat = TensionManager.calculateNarrativeBeat(graphSnapshot.global_state.turn_count, 0);

  // 1. TELEMETRY: Local Llama 3.2 (The Empath)
  const telemetry = await localMediaService.analyzeIntent(playerInput)
    .catch(() => ({ intent: 'neutral', subtext: 'genuine', intensity: 5 }));

  // 2. LOGIC: Engine & Motif Selection
  let activeEngineKey = "PROTOCOL"; 
  let activeMotif = MOTIF_LIBRARY.MEASURED_STRIKE;
  let xAxis = "Order"; 
  let yAxis = "Physical";

  // Deterministic routing based on telemetry
  if (telemetry.subtext === 'sarcastic' || telemetry.intent === 'defiance') {
    activeEngineKey = "PROTOCOL";
    activeMotif = MOTIF_LIBRARY.SYMBOLIC_CASTRATION;
    xAxis = "Order"; yAxis = "Existential";
  } else if (telemetry.intent === 'submission' && telemetry.intensity < 5) {
    activeEngineKey = "MASQUERADE";
    activeMotif = MOTIF_LIBRARY.HEALERS_BIND;
    xAxis = "Chaos"; yAxis = "Psychological";
  } else if (telemetry.intent === 'fear') {
    activeEngineKey = "SPECTACLE";
    activeMotif = MOTIF_LIBRARY.AUDIENCE_REACTION;
    xAxis = "Chaos"; yAxis = "Physical";
  }

  // Location Overrides
  if (['Refectory', 'Grounds'].includes(currentLocation)) activeEngineKey = "SPECTACLE";
  if (['Bathhouse', 'Dormitories'].includes(currentLocation)) activeEngineKey = "MASQUERADE";

  // @ts-ignore
  const engineData = THEMATIC_ENGINES[activeEngineKey];
  const beatInstruction = TensionManager.getBeatInstructions(narrativeBeat as any);

  // 3. GRAPHRAG RETRIEVAL
  // Retrieve relevant past memories and faded grudges to augment the context
  const ragContext = await controller.getRAGAugmentedPrompt(playerInput + " " + currentLocation);

  // 4. PROMPT CONSTRUCTION
  const finalPrompt = `
${DIRECTOR_SYSTEM_INSTRUCTIONS}

=== LORE MANDATES (IMMUTABLE) ===
${LORE_APPENDIX.VERNACULAR_OF_DIMINUTION}
${LORE_CONSTITUTION.VOICE_MANDATES}

=== PSYCHOMETRIC TELEMETRY (Llama-1B) ===
INPUT: "${playerInput}"
INTENT: ${telemetry.intent.toUpperCase()}
SUBTEXT: ${telemetry.subtext.toUpperCase()}
INTENSITY: ${telemetry.intensity}/10

=== GRAPHRAG CONTEXT (MEMORY & DECAY) ===
${ragContext}

=== NARRATIVE COORDINATES ===
X-AXIS: ${xAxis} (Function)
Y-AXIS: ${yAxis} (Trauma Intensity)

=== ACTIVE ENGINE: ${engineData.label} ===
GOAL: ${engineData.goal}
TONE: ${engineData.tone}
VOCABULARY LOCK: ${engineData.vocabulary.join(', ')}

=== ACTIVE MOTIF: ${activeMotif.name} ===
QUOTE: "${activeMotif.quote}"
VISUAL ANCHOR: ${activeMotif.visual}

=== CURRENT STATE ===
LOCATION: ${currentLocation}
BEAT: ${narrativeBeat} (${beatInstruction})
LEDGER: ${JSON.stringify(ledger)}
PREFECTS:
${buildPrefectContextBlock(activePrefects)}
HISTORY:
${history.slice(-5).join('\n')}

=== TASK ===
Generate the JSON response strictly adhering to the schema.

1. **THINK**: Plan the scene using the "Rhythm of Escalation" and retrieved memory evidence.
2. **NARRATE**: Use the **NARRATIVE TEXTURE** guidelines. Focus on SOMATIC SENSATION.
3. **SOMATIC STATE**: Populate the 'somatic_state' field.
4. **MEMORY & RELATIONAL STORAGE (CRITICAL)**:
   You are the Co-Writer. You MUST store internal state changes using 'kgot_mutations':
   - If an agent is insulted or defied -> 'update_grudge' (+10 to +30).
   - If an agent is obeyed or manipulated -> 'update_relationship' (Trust/Favor).
   - If a significant plot event occurs -> 'add_memory' (Describe the event clearly).
   - If the player is injured -> 'add_injury'.
   *DO NOT leave the graph static. Every turn must impact the web of relationships.*

5. **UPDATE**: Modify the YandereLedger.
`;

  // 5. EXECUTE FLASH-LITE (New SDK Syntax)
  try {
    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        config: {
          // Lite Optimization: Thinking + Strict Schema
          thinkingConfig: { 
            includeThoughts: true, 
            thinkingBudget: 1024 
          },
          responseMimeType: "application/json",
          responseSchema: UnifiedDirectorOutputSchema,
        },
      });
    });

    let rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let cleanFixed = rawText.replace(/```json|```/g, '').trim();
    let unifiedOutput;

    // First attempt to parse
    try {
        unifiedOutput = JSON.parse(cleanFixed);
    } catch (e) {
        console.warn("Initial JSON parse failed. Attempting Llama worker repair...");
        
        // --- CRITICAL REPAIR STEP ---
        try {
            // Use the local worker (Llama) to repair the string
            const repairedJsonString = await localGrunt.repairJson(cleanFixed);
            unifiedOutput = JSON.parse(repairedJsonString);
            console.log("JSON successfully repaired by Llama worker.");
        } catch (repairError) {
             console.error("Llama repair failed. Throwing original error.", repairError);
             throw new Error(`Critical JSON failure after repair attempt: ${(repairError as Error).message}`);
        }
    }
    // End CRITICAL REPAIR STEP

    // Apply State Updates (Assuming successful parse/repair)
    if (unifiedOutput.kgot_mutations) controller.applyMutations(unifiedOutput.kgot_mutations);
    if (unifiedOutput.ledger_update) controller.updateLedger('Subject_84', unifiedOutput.ledger_update);

    return unifiedOutput;

  } catch (error: any) {
    console.error("Unified Director Failed:", error);
    // Fallback schema matching structure
    return {
        meta_analysis: { selected_engine: 'PROTOCOL', player_psych_profile: 'Error' },
        reasoning_graph: { nodes: [], selected_path: [] },
        narrative_text: `The Loom shudders. System disconnect. The Architect is offline. (${error.message || 'Unknown LLM error'})`,
        visual_prompt: "Static. Chromatic Aberration.",
        choices: ["Observe the damage", "Try to reset the panel"],
        prefect_simulations: [],
        script: [],
        kgot_mutations: [],
        ledger_update: {},
        audio_cues: []
    };
  }
}