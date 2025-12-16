import { GoogleGenAI, Type } from "@google/genai";
import { KGotController } from "../controllers/KGotController";
import { DIRECTOR_SYSTEM_INSTRUCTIONS } from "../config/directorCore";
import { LORE_APPENDIX, LORE_CONSTITUTION } from "../config/loreInjection"; 
import { THEMATIC_ENGINES, MOTIF_LIBRARY } from "../config/directorEngines";
import { UnifiedDirectorOutputSchema } from "./schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger } from "../types";
import { INITIAL_LEDGER } from "../constants";
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

/**
 * Extracts explicit high-level state (Memories, Grudges, Secrets, Relationships) from the Knowledge Graph
 * to ensure the narrative remains continuous and reactive to past events.
 */
function getNarrativeContext(controller: KGotController): string {
    const graph = controller.getGraph();
    const subjectNode = graph.nodes['Subject_84'];
    
    if (!subjectNode) return "No prior memory records found.";

    const attributes = subjectNode.attributes || {};
    
    // 1. Recent Memories (Last 5 turns)
    const recentMemories = (attributes.memories || [])
        .slice(-5)
        .map((m: any) => `- [Turn ${m.timestamp}] ${m.description} (${m.emotional_imprint})`)
        .join('\n');

    // 2. Active Grudges (Intensity > 20)
    // Grudges are stored on Prefect nodes, targeting the player or other prefects
    const activeGrudges: string[] = [];
    Object.values(graph.nodes).forEach((node: any) => {
        if (node.type === 'PREFECT' || node.type === 'FACULTY') {
            const grudges = node.attributes?.grudges || {};
            Object.entries(grudges).forEach(([target, intensity]) => {
                if ((intensity as number) > 20) {
                    // Resolve target name
                    const targetName = graph.nodes[target]?.label || target;
                    activeGrudges.push(`- ${node.label} holds a GRUDGE against ${targetName} (Intensity: ${intensity})`);
                }
            });
        }
    });

    // 3. Relationship Dynamics (Trust/Favor)
    const relationshipStates: string[] = [];
    Object.values(graph.nodes).forEach((node: any) => {
        if ((node.type === 'PREFECT' || node.type === 'SUBJECT') && node.attributes?.prefectDNA) {
            const rels = node.attributes.prefectDNA.relationships || {};
            const activeRels = Object.entries(rels)
                .filter(([_, val]) => Math.abs(val as number) > 0.1) // Only significant relationships
                .map(([target, val]) => {
                    const targetName = graph.nodes[target]?.label || target;
                    return `${targetName}: ${(val as number).toFixed(2)}`;
                });
            
            if (activeRels.length > 0) {
                relationshipStates.push(`- ${node.label} BONDS: [${activeRels.join(', ')}]`);
            }
        }
    });

    // 4. Known Secrets
    const knownSecrets = (attributes.secrets || [])
        .map((s: any) => `- SECRET: "${s.name}" discovered by ${s.discoveredBy}`)
        .join('\n');

    // 5. Physical Injuries
    const injuries = (attributes.injuries || []).join(', ');

    return `
=== EXPLICIT MEMORY & RELATIONSHIP STATE ===
[RECENT MEMORIES]
${recentMemories || "None."}

[ACTIVE GRUDGES & TENSIONS]
${activeGrudges.length > 0 ? activeGrudges.join('\n') : "None."}

[RELATIONSHIP DYNAMICS]
${relationshipStates.length > 0 ? relationshipStates.join('\n') : "None established."}

[DISCOVERED SECRETS]
${knownSecrets || "None."}

[PHYSICAL TRAUMA]
Injuries: ${injuries || "None."}
    `.trim();
}

export async function executeUnifiedDirectorTurn(
  playerInput: string,
  history: string[],
  currentGraphData: any, // Using any here to accept the raw graph object from store
  activePrefects: PrefectDNA[],
  isLiteMode: boolean = false,
  modelId: string = 'gemini-2.5-flash'
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

  // 3. RETRIEVAL & CONTEXT INJECTION (Uplifted Architecture)
  const explicitContext = getNarrativeContext(controller);
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

=== LONG-TERM MEMORY & CONTEXT (THE CONTINUOUS STORY) ===
${explicitContext}

=== GRAPHRAG ASSOCIATIONS (Subconscious/Implicit) ===
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

=== TASK: CREATIVE CO-WRITER & DIRECTOR ===
Generate the JSON response strictly adhering to the schema.

1. **THINK**: Plan the scene. YOU MUST REFERENCE PAST EVENTS (Memories/Grudges) if relevant to maintain continuity.
2. **NARRATE**: Use the **NARRATIVE TEXTURE** guidelines. Focus on SOMATIC SENSATION.
3. **DIALOGUE SCRIPTING (CRITICAL)**:
   - If ANY character speaks, populate the 'script' array.
   - Use 'narrative_text' for action/atmosphere.
4. **SOMATIC STATE**: Populate the 'somatic_state'.
5. **CONTINUOUS NARRATIVE MEMORY (THE LOOM)**:
   You are the Co-Writer. You MUST store internal state changes using 'kgot_mutations' to create a living world.
   **Do not be passive. Record the impact of this turn.**
   - **GRUDGES**: If an agent is insulted or defied -> 'update_grudge' (+10 to +30).
   - **RELATIONSHIPS**: If an agent is obeyed, charmed, or manipulated -> 'update_relationship' (Trust/Favor delta).
   - **MEMORIES**: If a significant plot event occurs (a revelation, an injury, a betrayal) -> 'add_memory' (Describe the event clearly).
   - **INJURIES**: If the player is injured -> 'add_injury'.
   *Every turn must impact the web of relationships.*

6. **UPDATE**: Modify the YandereLedger.
`;

  // 5. EXECUTE FLASH (New SDK Syntax)
  try {
    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        config: {
          // Thinking + Strict Schema
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