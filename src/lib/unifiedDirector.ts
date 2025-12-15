
import { GoogleGenAI } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { SYSTEM_INSTRUCTION_FULL } from "../config/loreInjection";
import { THEMATIC_ENGINES } from "../config/directorEngines";
import { UnifiedDirectorOutputSchema, UnifiedDirectorOutput } from "./schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger } from "../types";
import { INITIAL_LEDGER } from "../constants";
import { callGeminiWithRetry } from "../utils/apiRetry";
import { localMediaService, localGrunt } from "../services/localMediaService";

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

// --- FEW-SHOT EXAMPLES FOR FLASH-LITE OPTIMIZATION ---
const FEW_SHOT_EXAMPLES = `
### EXAMPLE 1 (High Trauma, Clinical Tone)
INPUT: "I... I can't stand up. Please stop."
OUTPUT:
{
  "thought_chain": "Subject is breaking. Switch to Nurse Anya. Frame the pain as a biological failure.",
  "narrative_prose": "You try to rise, but your legs are water. The nausea is a heavy, cold stone in your gut. Anya leans over you, her white coat pristine against the gloom. She sighs, not with pity, but with mild disappointment. 'Typical,' she murmurs, clicking a pen. 'The autonomic nervous system is rejecting the lesson. Hold still. I need to measure the swelling.' Her hands are terrifyingly warm.",
  "visual_cue": "Low angle, Nurse Anya looming over camera, holding a clipboard, haloed by harsh gaslight.",
  "audio_cue": "High-pitched tinnitus ringing, slow heartbeat, scratch of pen on paper.",
  "state_update": { "trauma_delta": 5, "hope_delta": -2, "compliance_delta": 5 },
  "choices": ["Apologize", "Whimper", "Close your eyes"]
}

### EXAMPLE 2 (Defiance, Kinetic Tone)
INPUT: "Go to hell! I won't do it!"
OUTPUT:
{
  "thought_chain": "Subject chose defiance. Activate Inquisitor Petra. Immediate kinetic escalation.",
  "narrative_prose": "The words barely leave your lips before the air cracks. It isn't a sound; it's a white flash behind your eyes. You don't feel the impact of Petra's boot so much as you feel the world dissolve. You are on the floor. The stone is cold against your cheek. Somewhere above you, a predatory giggle echoes. 'Oh, feisty!' Petra chirps. 'I love a moving target. Again.'",
  "visual_cue": "Blurry motion, Petra in a dynamic high-kick pose, Dutch angle, green tank top.",
  "audio_cue": "Wet thud of impact, sharp intake of breath, leather creaking, manic giggling.",
  "state_update": { "trauma_delta": 10, "hope_delta": 5, "compliance_delta": -5 },
  "choices": ["Spit blood", "Try to stand", "Curl up"]
}
`;

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
  // Use Flash-Lite as requested for speed/cost optimization
  const modelId = 'gemini-2.5-flash-lite';
  console.log(`⚡ [Unified Director] Starting Flash-Lite Turn (${modelId})...`);

  try {
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger: YandereLedger & { currentLocation?: string } = {
        ...(graphSnapshot.nodes['Subject_84']?.attributes?.ledger || INITIAL_LEDGER),
        currentLocation: graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || "The Calibration Chamber"
    };
    const location = ledger.currentLocation || "The Calibration Chamber";

    // Telemetry (Optional for Lite, but good context)
    let telemetry = { intent: 'neutral', subtext: 'genuine', intensity: 5 };
    if (!isLiteMode) { 
        telemetry = await localMediaService.analyzeIntent(playerInput);
    }

    // Determine Active Engine based on Input/State
    let directive = "Maintain current pressure.";
    if (ledger.traumaLevel > 60) directive = "Subject is unstable. Describe the world as tilting, loud, and disjointed.";
    if (telemetry.intent === 'defiance') directive = "Punish defiance. Activate Petra (Kinetic Correction).";
    else if (telemetry.intent === 'submission') directive = "Exploit submission. Activate Calista (Gaslighting) or Anya (Clinical).";

    // Construct the Prompt strictly following the protocol
    const unifiedPrompt = `
${SYSTEM_INSTRUCTION_FULL}

### CURRENT SIMULATION STATE
- **Location:** ${location}
- **Subject Status:** Trauma: ${ledger.traumaLevel}/100 | Hope: ${ledger.hopeLevel}/100 | Compliance: ${ledger.complianceScore}/100
- **Physical State:** ${ledger.physicalIntegrity < 50 ? "CRITICAL (Nausea, blurred vision)" : "STABLE (Anxious)"}
- **Active Agents:** ${activePrefects.map(p => p.displayName).join(", ")}

### PLAYER INPUT
"${playerInput}"

### DIRECTIVE
1. Analyze the player's input (${telemetry.intent} / ${telemetry.subtext}).
2. ${directive}
3. Generate the response JSON strictly adhering to the schema.

${FEW_SHOT_EXAMPLES}
`;

    const ai = getAI();
    const response = await callGeminiWithRetry(async () => {
      return await ai.models.generateContent({
        model: modelId,
        contents: { parts: [{ text: unifiedPrompt }] },
        config: {
          responseSchema: UnifiedDirectorOutputSchema,
          responseMimeType: "application/json",
          temperature: 0.7, // As requested for balance
        },
      });
    }, "Director-Lite");

    const rawText = response.text || '{}';
    let output: UnifiedDirectorOutput;

    try {
        output = JSON.parse(rawText);
    } catch (e) {
        console.warn("JSON repair required...");
        const fixed = await localGrunt.repairJson(rawText);
        output = JSON.parse(fixed);
    }

    // --- State & Memory Processing ---
    // Convert lite 'state_update' to full Ledger logic
    const ledgerUpdates: Partial<YandereLedger> = {
        traumaLevel: (ledger.traumaLevel || 0) + (output.state_update.trauma_delta || 0),
        hopeLevel: (ledger.hopeLevel || 0) + (output.state_update.hope_delta || 0),
        complianceScore: (ledger.complianceScore || 0) + (output.state_update.compliance_delta || 0)
    };

    // Auto-generate Memories/Grudges if impact is high
    const mutations: any[] = [];
    if (Math.abs(output.state_update.trauma_delta) > 5) {
        mutations.push({
            operation: 'add_memory',
            memory: {
                id: `mem_${Date.now()}`,
                description: output.thought_chain,
                emotional_imprint: output.state_update.trauma_delta > 0 ? "Trauma Spike" : "Relief",
                involved_entities: activePrefects.map(p => p.id),
                timestamp: graphSnapshot.global_state.turn_count
            }
        });
    }

    // Apply updates
    if (mutations.length > 0) controller.applyMutations(mutations);
    controller.updateLedger('Subject_84', ledgerUpdates);

    // Simple Script Parsing (Splitting prose by dialogue quotes if possible, else just narrator)
    const script = [{ speaker: "Narrator", text: output.narrative_prose }];

    return {
      narrative: output.narrative_prose,
      script: script,
      visualPrompt: output.visual_cue,
      updatedGraph: controller.getGraph(),
      choices: output.choices || ["Endure", "Observe", "Beg"],
      thoughtProcess: output.thought_chain,
      state_updates: ledgerUpdates,
      audioCues: [{ mode: "SFX", text_fragment: output.audio_cue }],
      psychosisText: undefined,
      prefectSimulations: [], // Lite mode skips deep agent simulation for speed
      audioMarkup: undefined
    };

  } catch (error: any) {
    console.error("Director-Lite Failed:", error);
    return {
      narrative: `The system flickers. (Error: ${error.message})`,
      script: [],
      visualPrompt: "Static.",
      updatedGraph: currentGraphData,
      choices: ["Retry"],
      thoughtProcess: "Error",
      state_updates: undefined,
      audioCues: [],
      psychosisText: undefined,
      prefectSimulations: [],
      audioMarkup: undefined
    };
  }
}
