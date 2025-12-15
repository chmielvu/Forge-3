
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { DIRECTOR_MASTER_PROMPT_TEMPLATE } from "../config/directorCore";
import { THEMATIC_ENGINES } from "../config/directorEngines";
import { UnifiedDirectorOutputSchema, UnifiedDirectorOutput } from "./schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger } from "../types";
import { INITIAL_LEDGER } from "../constants";
import { callGeminiWithRetry } from "../utils/apiRetry";
import { selectNarratorMode } from '../services/narratorEngine';
import { TensionManager } from "../services/TensionManager";
import { localGrunt } from '../services/localMediaService';

const getApiKey = (): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.API_KEY) return import.meta.env.API_KEY;
  } catch (e) {}
  return '';
};

const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

// --- HELPER: AGENCY/LUCK CHECK ---
function checkCriticalSuccess(ledger: YandereLedger): boolean {
    const chance = 0.05 + (ledger.hopeLevel / 1000);
    return Math.random() < chance;
}

// ... (Retain existing helper functions like getSpecificDriveInstruction, etc. for backward compat or refactor if desired. 
// For brevity, I will assume the prompt template uses the injected prefect block builder which we will include inline below.)

function getSpecificDriveInstruction(prefect: PrefectDNA): string {
  // Simplified for brevity, relying on Engine injection for main drive
  return `Act according to your archetype: ${prefect.archetype}`;
}

function buildPrefectContextBlock(
  activePrefects: PrefectDNA[],
  ledger: YandereLedger,
  playerInput: string,
  history: string[],
  currentLocation: string 
): string {
  const prefectProfiles = activePrefects.map((prefect, idx) => {
    const emotionalState = prefect.currentEmotionalState || { paranoia: 0.2, desperation: 0.2, confidence: 0.5, arousal: 0, dominance: 0.5 };
    
    // Inject Psychometrics for behavior enforcement
    const psychoData = prefect.psychometrics ? `
**PSYCHOMETRICS:**
- **TELL:** ${prefect.psychometrics.physiologicalTell} (MUST PERFORM THIS)
- **SOMATIC:** ${prefect.psychometrics.somaticSignature}
- **TRIGGER:** ${prefect.psychometrics.breakingPointTrigger}
- **STYLE:** ${prefect.psychometrics.tortureStyle}` : '';

    return `
### PREFECT ${idx + 1}: ${prefect.displayName} (${prefect.archetype})
**IDENTITY:** ID: ${prefect.id}, Drive: ${prefect.drive}, Weakness: ${prefect.secretWeakness}
**EMOTIONAL STATE:** Paranoia: ${(emotionalState.paranoia * 100).toFixed(0)}%, Confidence: ${(emotionalState.confidence * 100).toFixed(0)}%
${psychoData}
---`;
  }).join('\n');
  
  return `
# === ACTIVE PREFECTS IN SCENE ===
Simulate the thoughts/actions of these ${activePrefects.length} prefects.
**PLAYER STATE:** Trauma: ${ledger.traumaLevel}, Compliance: ${ledger.complianceScore}, Hope: ${ledger.hopeLevel}.
${prefectProfiles}
`;
}

/**
 * UNIFIED DIRECTOR: Logic Controller
 */
export async function executeUnifiedDirectorTurn(
  playerInput: string,
  history: string[],
  currentGraphData: KnowledgeGraph,
  activePrefects: PrefectDNA[],
  isLiteMode: boolean = false
): Promise<{
    narrative: string;
    script: Array<{ speaker: string; text: string; emotion?: string; }>;
    visualPrompt: string;
    updatedGraph: KnowledgeGraph;
    choices: string[];
    thoughtProcess: string;
    state_updates: Partial<YandereLedger> | undefined;
    audioCues: Array<{ mode: string; text_fragment: string; }> | undefined;
    psychosisText: string | undefined;
    prefectSimulations: Array<any>;
    audioMarkup: string | undefined;
}> {
  try {
    const modelId = 'gemini-2.5-flash'; 
    const useThinking = !isLiteMode; 

    console.log(`⚡ [Unified Director] Starting AGoT Reasoning using ${modelId}...`);
    
    // 1. Initialize Systems
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger: YandereLedger & { currentLocation?: string } = {
        ...(graphSnapshot.nodes['Subject_84']?.attributes?.ledger || INITIAL_LEDGER),
        currentLocation: graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || "The Calibration Chamber"
    };
    const location = ledger.currentLocation || "The Calibration Chamber";

    // --- 2. DETERMINE THEMATIC ENGINE (The "Why") ---
    let activeEngineKey: keyof typeof THEMATIC_ENGINES = "PROTOCOL"; // Default
    
    const locUpper = location.toUpperCase();
    if (["REFECTORY", "GROUNDS", "ARENA", "DOCK", "ARRIVAL"].some(l => locUpper.includes(l))) {
      activeEngineKey = "SPECTACLE";
    } 
    else if (["BATHHOUSE", "COMMON_ROOM", "CONFESSIONAL", "DORM"].some(l => locUpper.includes(l))) {
      activeEngineKey = "MASQUERADE";
    }
    else if (["RESEARCH_WING", "ISOLATION", "CALIBRATION", "CHAMBER", "INFIRMARY"].some(l => locUpper.includes(l))) {
      activeEngineKey = "PROTOCOL";
    }

    const engineData = THEMATIC_ENGINES[activeEngineKey];
    // Extract domain from string for the prompt replacement
    const domainMatch = engineData.match(/KEYWORD_DOMAIN: (.*)/);
    const semanticDomain = domainMatch ? domainMatch[1] : "GENERAL";

    // 2.5 Calculate Fortune
    const isCriticalSuccess = checkCriticalSuccess(ledger);
    const fortuneInjection = isCriticalSuccess 
      ? `**CRITICAL AGENCY EVENT:** The Subject's Hope has triggered a rare moment of clarity/luck.`
      : `STANDARD PHYSICS: Apply standard Trauma/Compliance constraints.`;

    // 3. Build unified prompt
    const prefectContextBlock = buildPrefectContextBlock(activePrefects, ledger, playerInput, history, location);
    
    // 3.5 Calculate Narrative Beat
    const turnCount = graphSnapshot.global_state.turn_count;
    const recentTraumaDelta = graphSnapshot.nodes['Subject_84']?.attributes?.last_trauma_delta || 0;
    const currentBeat = TensionManager.calculateNarrativeBeat(turnCount, recentTraumaDelta);
    const beatInstruction = TensionManager.getBeatInstructions(currentBeat);

    // 3.6 Get Spotlight Context
    const spotlight = controller.getNarrativeSpotlight(
      "Subject_84",
      location,
      activePrefects.map(p => p.id)
    );

    // --- PHASE 0: CONTEXT COMPRESSION ---
    let contextHistory = "";
    if (history.length > 15) {
        const oldLogs = history.slice(0, -15).join('\n');
        const recentLogs = history.slice(-15).join('\n---\n');
        try {
            const summary = await localGrunt.summarizeHistory(oldLogs);
            contextHistory = `ARCHIVE SUMMARY: ${summary}\n\nRECENT LOGS:\n${recentLogs}`;
        } catch (e) {
            contextHistory = history.slice(-20).join('\n---\n');
        }
    } else {
        contextHistory = history.join('\n---\n');
    }

    const unifiedPrompt = DIRECTOR_MASTER_PROMPT_TEMPLATE
      .replace('{{active_engine_data}}', engineData)
      .replace('{{active_engine_name}}', activeEngineKey)
      .replace('{{semantic_domain}}', semanticDomain)
      .replace('{{narrative_beat}}', currentBeat)
      .replace('{{beat_instruction}}', beatInstruction)
      .replace('{{ledger}}', JSON.stringify(ledger, null, 2))
      .replace('{{narrative_spotlight}}', JSON.stringify(spotlight, null, 2))
      .replace('{{active_prefects}}', prefectContextBlock)
      .replace('{{history}}', contextHistory)
      .replace('{{player_input}}', playerInput)
      .replace('{{fortuneInjection}}', fortuneInjection);
    
    const ai = getAI();
    const response = await callGeminiWithRetry<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: modelId, 
        contents: [{ role: 'user', parts: [{ text: unifiedPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: UnifiedDirectorOutputSchema,
          temperature: 1.0, 
          thinkingConfig: useThinking ? { thinkingBudget: 2048 } : undefined 
        }
      }),
      "Unified Director"
    );
    
    const outputText = response.text || "{}";
    let unifiedOutput: UnifiedDirectorOutput;

    try {
      unifiedOutput = JSON.parse(outputText);
    } catch (parseError) {
      console.warn("Director JSON malformed. Invoking Grunt repair...");
      try {
          const fixed = await localGrunt.repairJson(outputText);
          const cleanFixed = fixed.replace(/```json|```/g, '').trim(); 
          unifiedOutput = JSON.parse(cleanFixed);
      } catch (err) {
          console.error("Critical JSON failure:", err);
          throw new Error(`Invalid JSON response from AI.`);
      }
    }

    // 4. Apply mutations
    if (unifiedOutput.kgot_mutations) {
      controller.applyMutations(unifiedOutput.kgot_mutations);
    }
    if (unifiedOutput.ledger_update) {
      controller.updateLedger('Subject_84', unifiedOutput.ledger_update);
    }
    
    // 5. Combine somatic + narrative
    const combinedNarrative = `
<span class="somatic-nova">${unifiedOutput.somatic_state?.impact_sensation || ""}</span>

<span class="somatic-void">${unifiedOutput.somatic_state?.internal_collapse || ""}</span>

${unifiedOutput.narrative_text}
`;
    
    // Construct the Cognitive Graph trace log
    const nodesTrace = unifiedOutput.reasoning_graph?.nodes.map(n => `[${n.type}] ${n.content}`).join('\n  ');
    const cognitiveTrace = `
AGOT REASONING TRACE (${modelId}):
-------------------------
ENGINE: ${unifiedOutput.meta_analysis.selected_engine}
PROFILE: ${unifiedOutput.meta_analysis.player_psych_profile}

GRAPH:
  ${nodesTrace}
    `.trim();

    return {
      narrative: combinedNarrative,
      script: unifiedOutput.script || [],
      visualPrompt: unifiedOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: unifiedOutput.choices || ["Endure", "Observe"],
      thoughtProcess: cognitiveTrace,
      state_updates: unifiedOutput.ledger_update,
      audioCues: unifiedOutput.audio_cues,
      psychosisText: unifiedOutput.psychosis_text,
      prefectSimulations: unifiedOutput.prefect_simulations || [],
      audioMarkup: unifiedOutput.audio_markup
    };
    
  } catch (error: any) {
    console.error("Unified Director Failed:", error);
    const errorMessage = error.message || "Unknown AI error.";
    return {
      narrative: `The Loom shudders. A neural-symbolic disconnect. (${errorMessage})`,
      script: [{ speaker: "System", text: `ERROR: Neuro-Symbolic disconnect. (${errorMessage.substring(0,100)}...)` }],
      visualPrompt: "Static.",
      updatedGraph: currentGraphData,
      choices: ["Attempt to re-stabilize"],
      thoughtProcess: `Error: ${errorMessage}`,
      state_updates: {}, 
      audioCues: [],
      psychosisText: "ERROR",
      prefectSimulations: [],
      audioMarkup: undefined,
    };
  }
}
