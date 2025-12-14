
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { DIRECTOR_CORE_IDENTITY, DIRECTOR_FACULTY_PSYCHOLOGY } from "../config/directorCore";
import { UnifiedDirectorOutputSchema, UnifiedDirectorOutput } from "./schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger, GameState } from "../types";
import { INITIAL_LEDGER } from "../constants";
import { callGeminiWithRetry } from "../utils/apiRetry";

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

// --- HELPER FUNCTIONS FOR AGENT LOGIC ---

function getSpecificDriveInstruction(archetype: string): string {
  switch (archetype) {
    case 'The Sadist': 
      return "Prioritize 'public_action' that involves kinetic punishment or physical impact. Violence is your language.";
    case 'The Nurse': 
      return "Prioritize 'public_action' that involves invasive medical examination or 'caring' manipulation of the body.";
    case 'The Zealot': 
      return "Prioritize 'public_action' that enforces rules or cites scripture to correct behavior.";
    case 'The Yandere': 
      return "Prioritize 'public_action' that physically isolates or claims ownership of the Subject.";
    case 'The Dissident': 
      return "Prioritize 'public_action' that mocks the Subject publicly while signaling safety privately.";
    default: 
      return "Prioritize 'public_action' that actively demonstrates your dominance and competence.";
  }
}

function getSpecificWeaknessInstruction(archetype: string): string {
  switch (archetype) {
    case 'The Zealot': 
      return "You MUST show visible hesitation (a flinch, a stutter, looking away) when ordering violence, then immediately overcompensate with loud scripture.";
    case 'The Nurse': 
      return "MANDATORY ACTION STRUCTURE: You must begin 'public_action' with a tactile medical examination or soothing gesture. Immediately follow this with a probing question about secrets or rival Prefects, framed as a necessary diagnostic query.";
    case 'The Yandere': 
      return "You MUST reveal your instability. If the subject is threatened by others, snap into violence. If they are alone with you, be terrifyingly sweet.";
    case 'The Dissident': 
      return "You MUST act bored or cruel to the audience, but drop a subtle hint (a glance, a relaxed grip) that you are not truly invested.";
    case 'The Sadist': 
      return "You MUST betray your enjoyment of the pain. A smile you can't hide, dilated pupils, or a shudder of pleasure.";
    default: 
      return "Ensure your secret weakness acts as a visible 'tell' or constraint on your action.";
  }
}

/**
 * Builds the context block for active prefects
 * This replaces the individual FilteredSceneContext for each agent
 */
function buildPrefectContextBlock(
  activePrefects: PrefectDNA[],
  ledger: YandereLedger,
  playerInput: string,
  history: string[]
): string {
  const prefectProfiles = activePrefects.map((prefect, idx) => {
    const relationships = Object.entries(prefect.relationships)
      .map(([targetId, score]) => {
        const name = targetId.includes('PREFECT') ? targetId.split('_')[2] : targetId;
        const sentiment = score > 0 ? "Ally" : "Rival";
        return `${name}: ${sentiment} (${score.toFixed(1)})`;
      })
      .join(', ');
    
    const emotionalState = prefect.currentEmotionalState || { paranoia: 0.2, desperation: 0.2, confidence: 0.5 };
    
    // Archetype-specific logic integration
    const driveInstr = getSpecificDriveInstruction(prefect.archetype);
    const weaknessInstr = getSpecificWeaknessInstruction(prefect.archetype);

    return `
### PREFECT ${idx + 1}: ${prefect.displayName} (${prefect.archetype})

**IDENTITY:**
- ID: ${prefect.id}
- Drive: ${prefect.drive}
- Secret Weakness: ${prefect.secretWeakness}
- Favor Score: ${prefect.favorScore}/100

**TRAITS:**
- Cruelty: ${prefect.traitVector.cruelty.toFixed(2)}
- Charisma: ${prefect.traitVector.charisma.toFixed(2)}
- Cunning: ${prefect.traitVector.cunning.toFixed(2)}
- Submission to Authority: ${prefect.traitVector.submission_to_authority.toFixed(2)}
- Ambition: ${prefect.traitVector.ambition.toFixed(2)}

**CURRENT EMOTIONAL STATE:**
- Paranoia: ${(emotionalState.paranoia * 100).toFixed(0)}%
- Desperation: ${(emotionalState.desperation * 100).toFixed(0)}%
- Confidence: ${(emotionalState.confidence * 100).toFixed(0)}%

**RELATIONSHIPS:** ${relationships || "None established"}

**RECENT ACTION:** ${prefect.lastPublicAction || "First appearance"}

**KNOWLEDGE/SECRETS:** ${(prefect.knowledge || []).join('; ') || "None yet"}

**BEHAVIORAL MANDATES (HIGHEST PRIORITY):**
1. **DRIVE ADVANCEMENT:** ${driveInstr}
2. **WEAKNESS MANIFESTATION:** ${weaknessInstr}
   (The weakness MUST appear in the 'public_action' text as a physical or tonal tell).

---`;
  }).join('\n');
  
  return `
# === ACTIVE PREFECTS IN SCENE ===

You must simulate the thoughts and actions of these ${activePrefects.length} prefects simultaneously.
For EACH prefect, generate their response to the player's action: "${playerInput}"

**CRITICAL INSTRUCTIONS:**
1. Each prefect acts INDEPENDENTLY based on their unique personality, not as a hive mind
2. Prefects can CONTRADICT each other (e.g., Elara wants compliance, Rhea secretly signals resistance)
3. Apply the EMOTIONAL STRATEGY LAYER: If a prefect has high paranoia, they should be defensive/suspicious
4. FAVOR SCORE LOGIC: Prefects with low favor (<40) are desperate and take risks
5. **DRIVE & WEAKNESS:** Ensure the specific behavioral mandates for each prefect are executed in their 'public_action'.

**PLAYER STATE FOR CONTEXT:**
- Trauma: ${ledger.traumaLevel}/100
- Compliance: ${ledger.complianceScore}/100
- Hope: ${ledger.hopeLevel}/100

${prefectProfiles}

**OUTPUT REQUIREMENT:**
Generate the "prefect_simulations" array with one entry per prefect above.
`;
}

/**
 * UNIFIED DIRECTOR: Single API call that handles both prefect simulation + narrative generation
 */
export async function executeUnifiedDirectorTurn(
  playerInput: string,
  history: string[],
  currentGraphData: KnowledgeGraph,
  activePrefects: PrefectDNA[] // Pass in 2-3 selected prefects
) {
  try {
    console.log("⚡ [Unified Director] Starting single-agent turn...");
    
    // 1. Initialize Systems
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger: YandereLedger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || INITIAL_LEDGER;
    
    // 2. Build unified prompt that includes BOTH prefect simulation AND narrative synthesis
    const prefectContextBlock = buildPrefectContextBlock(activePrefects, ledger, playerInput, history);
    
    const unifiedPrompt = `
${DIRECTOR_CORE_IDENTITY}

${DIRECTOR_FACULTY_PSYCHOLOGY}

# === UNIFIED TURN EXECUTION PROTOCOL ===

You are executing a SINGLE INTEGRATED TURN with two phases in one inference:

## PHASE 1: PREFECT AGENT SIMULATION (Role-Based Reasoning)
${prefectContextBlock}

## PHASE 2: NARRATIVE SYNTHESIS (Your Traditional Role)

Now that you have simulated the prefect thoughts, integrate them into a cohesive scene.

**PLAYER INPUT:** "${playerInput}"
**TURN:** ${graphSnapshot.global_state.turn_count}
**LOCATION:** ${graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || "The Calibration Chamber"}

**PSYCHOMETRIC LEDGER:**
- Trauma: ${ledger.traumaLevel}/100
- Compliance: ${ledger.complianceScore}/100
- Hope: ${ledger.hopeLevel}/100
- Shame: ${ledger.shamePainAbyssLevel}/100
- Physical Integrity: ${ledger.physicalIntegrity}/100

**RECENT NARRATIVE HISTORY:**
${history.slice(-3).join('\n---\n')}

---

# === YOUR TASK ===

Generate a UNIFIED JSON output containing:

1. **prefect_simulations**: Array of prefect thoughts (from Phase 1)
   - Each prefect's public_action, hidden_motivation, emotional_state, etc.
   - Ensure they CONTRADICT and CONFLICT where appropriate
   
2. **narrative_text**: The integrated scene (from Phase 2)
   - Weave ALL prefect actions into a single flowing narrative
   - Apply the "Grammar of Suffering" if trauma is inflicted
   - Show character interactions and conflicts
   - 300-500 words minimum
   
3. **somatic_state**: If the player experiences physical trauma
   - impact_sensation: The Nova/immediate sensation
   - internal_collapse: The Abdominal Void/systemic crisis
   
4. **visual_prompt**: A concise, descriptive string of the visual scene for image generation (e.g. 'Kaelen standing over Subject 84, holding a knife, expression of manic obsession'). Do not output JSON here, just the description string.
   
5. **choices**: 3-4 player options
6. **ledger_update**: Numerical deltas to YandereLedger
7. **kgot_mutations**: Graph updates (relationships, memories)

**CRITICAL NARRATIVE INTEGRATION RULE:**
Do NOT write separate sections for each prefect. Write ONE unified scene where:
- Prefect A says/does something
- Prefect B reacts to Prefect A
- The player observes this dynamic
- The Faculty (if present) moderates or escalates

Example structure:
"Elara stepped forward, her voice brittle. 'The rules demand—' But Kaelen cut her off with a 
sharp giggle, eyes locked on Subject 84. 'Rules? I have a better idea.' The tension crackled 
as Rhea watched from the shadows, calculating..."

Execute with maximum depth and psychological precision.
`;
    
    // 3. Single API Call with structured output using Gemini 3 Pro Preview
    const ai = getAI();
    const response = await callGeminiWithRetry<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Using Pro for complex reasoning as requested
        contents: [{ role: 'user', parts: [{ text: unifiedPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: UnifiedDirectorOutputSchema,
          temperature: 1.0,
        }
      }),
      "Unified Director"
    );
    
    const outputText = response.text || "{}";
    const unifiedOutput: UnifiedDirectorOutput = JSON.parse(outputText);
    
    // 4. Apply mutations (same as before)
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
    
    // 6. Return result (includes prefect simulation data for state updates)
    return {
      narrative: combinedNarrative,
      visualPrompt: unifiedOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: unifiedOutput.choices || ["Endure", "Observe"],
      thoughtProcess: `Unified: ${unifiedOutput.thought_signature}`,
      state_updates: unifiedOutput.ledger_update,
      audioCues: unifiedOutput.audio_cues,
      psychosisText: unifiedOutput.psychosis_text,
      
      // NEW: Prefect simulation results for gameStore to process
      prefectSimulations: unifiedOutput.prefect_simulations
    };
    
  } catch (error) {
    console.error("Unified Director Failed:", error);
    return {
      narrative: "The Loom shudders. The simulation has de-synced. (AI Error)",
      visualPrompt: "Static.",
      updatedGraph: currentGraphData,
      choices: ["Retry"],
      thoughtProcess: "Error",
      state_updates: {},
      audioCues: [],
      psychosisText: "...",
      prefectSimulations: []
    };
  }
}
