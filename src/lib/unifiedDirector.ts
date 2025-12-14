
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
 * Derives a specific short-term goal for a prefect based on current ledger and context.
 */
function deriveShortTermGoal(prefect: PrefectDNA, ledger: YandereLedger, rivals: string[]): string {
  const { traumaLevel, complianceScore, hopeLevel, physicalIntegrity } = ledger;
  
  switch (prefect.archetype) {
    case 'The Yandere':
      if (rivals.length > 0) return "Aggressively insert yourself between the Subject and the other Prefect to block their access.";
      if (complianceScore < 30) return "Threaten the Subject with a 'purification' ritual if they do not look at you immediately.";
      if (hopeLevel > 50) return "Destroy a small object of hope belonging to the Subject, then claim you did it for their own good.";
      return "Touch the Subject to claim ownership and whisper a possessive secret that terrifies them.";
      
    case 'The Zealot':
      if (traumaLevel < 40) return "Find a minor infraction (posture, eye contact) and blow it out of proportion to justify immediate punishment.";
      if (hopeLevel > 60) return "Crush the Subject's hope by citing the inevitability of the Codex's final chapter.";
      if (complianceScore > 80) return "Praise the Subject awkwardly, then recoil as if you've done something wrong.";
      return "Demand the Subject recite a rule from the Codex, then physically correct their tone.";
      
    case 'The Nurse':
      if (physicalIntegrity < 70) return "Use a medical check-up to invade personal space and extract a secret about another Prefect.";
      if (traumaLevel > 80) return "Offer a sedative that is actually a truth serum, framed as mercy.";
      return "Perform a 'preventative' examination that is humiliating but non-violent.";
      
    case 'The Dissident':
      if (rivals.includes('The Zealot')) return "Mock The Zealot's rigid adherence to rules to undermine her authority in front of the Subject.";
      if (hopeLevel < 20) return "Drop a physical token (key, note) near the Subject while berating them verbally.";
      return "Perform a cruel act for the cameras, but give the Subject a signal (wink, squeeze) that it is performance.";
      
    case 'The Sadist':
      if (complianceScore > 90) return "Invent a reason to punish the Subject anyway, proving that obedience does not guarantee safety.";
      return "Escalate the physical stakes. Make the Subject flinch visibly.";
      
    default:
      return "Assert dominance over the scene and force the Subject to acknowledge your rank.";
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
  const rivalsInScene = activePrefects.map(p => p.archetype);

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
    const sceneGoal = deriveShortTermGoal(prefect, ledger, rivalsInScene.filter(r => r !== prefect.archetype));

    // Identify active rivals in the scene to inject specific conflict triggers
    let conflictTrigger = "";
    
    if (prefect.archetype === 'The Zealot' && rivalsInScene.includes('The Yandere')) {
        conflictTrigger = "CONFLICT TRIGGER: You are terrified of the Yandere's instability. If she gets close to the subject, INTERVENE with a rule citation to separate them.";
    }
    if (prefect.archetype === 'The Yandere' && rivalsInScene.includes('The Zealot')) {
        conflictTrigger = "CONFLICT TRIGGER: The Zealot is trying to take your toy away with her 'rules'. Ignore her or threaten her subtly.";
    }
    if (prefect.archetype === 'The Sadist' && rivalsInScene.includes('The Nurse')) {
        conflictTrigger = "CONFLICT TRIGGER: The Nurse is 'coddling' the subject. Break something she just fixed to prove a point.";
    }

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

**BEHAVIORAL MANDATES (HIGHEST PRIORITY):**
1. **CURRENT SCENE GOAL (MANDATORY):** "${sceneGoal}"
   (You MUST attempt to achieve this specific goal in the current turn).
2. **WEAKNESS MANIFESTATION:** ${weaknessInstr}
   (The weakness MUST appear in the 'public_action' text as a physical or tonal tell).
3. **${conflictTrigger || "MAINTAIN STATUS QUO"}**

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
4. **MANDATORY GOAL:** Ensure the 'current_scene_goal' provided above is the primary driver of their 'public_action'.

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
  activePrefects: PrefectDNA[], // Pass in 2-3 selected prefects
  isLiteMode: boolean = false // Dynamic Model Switching
) {
  try {
    const modelId = isLiteMode ? 'gemini-2.5-flash' : 'gemini-3-pro-preview';
    console.log(`⚡ [Unified Director] Starting single-agent turn using ${modelId}...`);
    
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
   - Include the 'current_scene_goal' you are pursuing.
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
    
    // 3. Single API Call with structured output using Gemini 3 Pro Preview (or Flash in Lite Mode)
    const ai = getAI();
    const response = await callGeminiWithRetry<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: modelId, 
        contents: [{ role: 'user', parts: [{ text: unifiedPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: UnifiedDirectorOutputSchema,
          temperature: isLiteMode ? 0.7 : 1.0, // Lower temp for Flash to ensure JSON stability
        }
      }),
      "Unified Director"
    );
    
    const outputText = response.text || "{}";
    let unifiedOutput: UnifiedDirectorOutput;

    try {
      unifiedOutput = JSON.parse(outputText);
    } catch (parseError) {
      console.error("Failed to parse Unified Director output JSON:", parseError);
      throw new Error(`Invalid JSON response from AI: ${outputText.substring(0, 200)}...`);
    }
    
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
      thoughtProcess: `[${isLiteMode ? 'LITE' : 'PRO'}] Unified: ${unifiedOutput.thought_signature}`,
      state_updates: unifiedOutput.ledger_update,
      audioCues: unifiedOutput.audio_cues,
      psychosisText: unifiedOutput.psychosis_text,
      
      // NEW: Prefect simulation results for gameStore to process
      prefectSimulations: unifiedOutput.prefect_simulations
    };
    
  } catch (error: any) {
    console.error("Unified Director Failed:", error);
    const errorMessage = error.message || "Unknown AI error.";
    return {
      narrative: `The Loom shudders. A neural-symbolic disconnect. (${errorMessage})`,
      visualPrompt: "Static. Glitching pixels.",
      updatedGraph: currentGraphData,
      choices: ["Attempt to re-stabilize neural link"],
      thoughtProcess: `Error: ${errorMessage}`,
      state_updates: {}, // Ensure state_updates is an empty object on error
      audioCues: [],
      psychosisText: "REALITY_FLICKERS::PATTERN_BREAK"
    };
  }
}
