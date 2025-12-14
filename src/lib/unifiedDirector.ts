
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { DIRECTOR_CORE_IDENTITY, DIRECTOR_FACULTY_PSYCHOLOGY } from "../config/directorCore";
import { UnifiedDirectorOutputSchema, UnifiedDirectorOutput } from "./schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger, GameState } from "../types";
import { INITIAL_LEDGER } from "../constants";
import { callGeminiWithRetry } from "../utils/apiRetry";
import { narrativeQualityEngine } from "../services/narrativeQualityEngine";
import { selectNarratorMode, NARRATOR_VOICES } from '../services/narratorEngine';

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
    // 1. Analyze Relationships with Active Rivals in the Scene
    let relationshipsDesc = "";
    let socialMandate = "";
    
    const otherActivePrefects = activePrefects.filter(p => p.id !== prefect.id);
    
    otherActivePrefects.forEach(other => {
        const score = prefect.relationships[other.id] || 0;
        const name = other.displayName;
        
        relationshipsDesc += `${name}: ${score.toFixed(1)} | `;

        if (score > 0.5) {
            socialMandate += `\n- **ALLIANCE (${name}):** You trust ${name}. Coordinate with them. Use 'alliance_signal' to show support or share a secret glance.`;
        } else if (score < -0.4) {
            socialMandate += `\n- **RIVALRY (${name}):** You despise ${name}. If they fail, mock them. If they succeed, try to undermine them via 'sabotage_attempt'. Do not let them outshine you.`;
        } else {
            socialMandate += `\n- **NEUTRAL (${name}):** Ignore ${name} unless they interfere with your goal.`;
        }
    });

    const emotionalState = prefect.currentEmotionalState || { paranoia: 0.2, desperation: 0.2, confidence: 0.5 };
    const driveInstr = getSpecificDriveInstruction(prefect.archetype);
    const weaknessInstr = getSpecificWeaknessInstruction(prefect.archetype);
    const sceneGoal = deriveShortTermGoal(prefect, ledger, rivalsInScene.filter(r => r !== prefect.archetype));

    if (!socialMandate) socialMandate = "\n- **STATUS QUO:** Maintain your rank. Do not show weakness.";

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

**RELATIONSHIPS:** ${relationshipsDesc || "None established"}

**BEHAVIORAL MANDATES (HIGHEST PRIORITY):**
1. **CURRENT SCENE GOAL (MANDATORY):** "${sceneGoal}"
2. **WEAKNESS MANIFESTATION:** ${weaknessInstr}
3. **SOCIAL DYNAMICS (RELATIONAL PRESSURE):** ${socialMandate}

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
5. **USE TOOLS:** Use 'sabotage_attempt' and 'alliance_signal' fields to enact the SOCIAL DYNAMICS mandates.

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
  activePrefects: PrefectDNA[],
  isLiteMode: boolean = false
) {
  try {
    const modelId = isLiteMode ? 'gemini-2.5-flash-lite-latest' : 'gemini-3-pro-preview';
    console.log(`⚡ [Unified Director] Starting single-agent turn using ${modelId}...`);
    
    // 1. Initialize Systems
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    const ledger: YandereLedger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || INITIAL_LEDGER;
    
    // 2. Select Narrator Mode
    const currentNarratorMode = selectNarratorMode(ledger);
    const voiceProfile = NARRATOR_VOICES[currentNarratorMode];

    // 3. Build unified prompt that includes BOTH prefect simulation AND narrative synthesis
    const prefectContextBlock = buildPrefectContextBlock(activePrefects, ledger, playerInput, history);
    
    const unifiedPrompt = `
${DIRECTOR_CORE_IDENTITY}

${DIRECTOR_FACULTY_PSYCHOLOGY}

# === UNIFIED TURN EXECUTION PROTOCOL ===

You are executing a SINGLE INTEGRATED TURN with three phases in one inference:

## PHASE 1: PREFECT AGENT SIMULATION (Role-Based Reasoning)
${prefectContextBlock}

## PHASE 2: NARRATIVE STRATEGY (I-MCTS Protocol)

Before generating the scene, you must perform an INTROSPECTIVE SIMULATION (I-MCTS).
**CRITICAL:** Do NOT skip this step. You must explicitly output the reasoning in 'thought_signature'.

1. **EXPAND:** Identify 3 potential narrative branches for this turn:
   - **Branch A: Immediate Trauma** (Kinetic escalation via Petra/Enforcer/Prefect)
   - **Branch B: Psychological Subversion** (Gaslighting via Calista/Nurse/Prefect)
   - **Branch C: Narrative Novelty** (Unexpected event, new mechanic, or rule shift)
   
2. **EVALUATE:** Score each branch (0-100) based on:
   - **Tension:** Does it increase the 'Abyss' metric?
   - **Coherence:** Does it fit the current 'Manara-Noir' visual state?
   - **Castration Anxiety:** Does it threaten the 'Seat of the Ego'?

3. **SELECT:** Choose the highest-scoring branch and execute it in Phase 3.

## PHASE 3: NARRATIVE SYNTHESIS (Execution)

Generate the final scene based on the Selected Branch from I-MCTS.

**NARRATIVE VOICE MANDATE:**
You are "The Abyss Narrator".
CURRENT MODE: **${currentNarratorMode}**
TONE: ${voiceProfile.tone}
STYLE RULE: ${voiceProfile.choiceBias === 'validates_pattern_recognition' ? 'Use detached, medical terminology. Analyze the horror.' : 'Use intimate, second-person accusation. Be the voice of their failure.'}
AUDIO MARKUP: You must also output 'audio_markup' containing the text wrapped in emotional tags (e.g. [WHISPER], [MOCKING], [FAST]) to guide the voice actor.

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
   
2. **thought_signature**: A string summarizing the I-MCTS process (Branches -> Scores -> Selection).
   
3. **narrative_text**: The integrated scene (from Phase 3).
   - Weave ALL prefect actions into a single flowing narrative.
   - Apply the "Grammar of Suffering" if trauma is inflicted.
   - 300-500 words minimum.
   
4. **audio_markup**: The narrative text augmented with performance tags.
   
5. **somatic_state**: 
   - impact_sensation: The Nova/immediate sensation
   - internal_collapse: The Abdominal Void/systemic crisis
   
6. **visual_prompt**: A concise, descriptive string of the visual scene.
   
7. **choices**: 3-4 player options
8. **ledger_update**: Numerical deltas to YandereLedger
9. **kgot_mutations**: Graph updates (relationships, memories)

**CRITICAL NARRATIVE INTEGRATION RULE:**
Do NOT write separate sections for each prefect. Write ONE unified scene where:
- Prefect A says/does something
- Prefect B reacts to Prefect A
- The player observes this dynamic
- The Faculty (if present) moderates or escalates

Execute with maximum depth and psychological precision.
`;
    
    const ai = getAI();
    const response = await callGeminiWithRetry<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: modelId, 
        contents: [{ role: 'user', parts: [{ text: unifiedPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: UnifiedDirectorOutputSchema,
          temperature: isLiteMode ? 0.7 : 1.0, 
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

    // 3.5. Aesthete Critique & Rewrite
    if (unifiedOutput.narrative_text) {
      try {
        const criticContext = `
          Active Prefects: ${activePrefects.map(p => p.archetype).join(', ')}.
          Player Trauma: ${ledger.traumaLevel}.
          Location: ${graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || "Unknown"}.
        `;

        const critique = await narrativeQualityEngine.critiqueWithAesthete(
          unifiedOutput.narrative_text,
          criticContext
        );

        if (critique.score < 85 && critique.rewrite_suggestion) {
          console.log(`[Unified Director] 🎨 Aesthete Rewrite Triggered (Score: ${critique.score}). Violations: ${critique.violations.join(', ')}`);
          unifiedOutput.narrative_text = critique.rewrite_suggestion;
          unifiedOutput.thought_signature += ` | [AESTHETE REWRITE: ${critique.violations[0] || "Tone Correction"}]`;
        }
      } catch (e) {
        console.warn("[Unified Director] Aesthete critique bypassed:", e);
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
    
    return {
      narrative: combinedNarrative,
      visualPrompt: unifiedOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: unifiedOutput.choices || ["Endure", "Observe"],
      thoughtProcess: `[${isLiteMode ? 'LITE' : 'PRO'}] Unified: ${unifiedOutput.thought_signature}`,
      state_updates: unifiedOutput.ledger_update,
      audioCues: unifiedOutput.audio_cues,
      psychosisText: unifiedOutput.psychosis_text,
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
      state_updates: {}, 
      audioCues: [],
      psychosisText: "REALITY_FLICKERS::PATTERN_BREAK"
    };
  }
}
