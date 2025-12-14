
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { DIRECTOR_MASTER_PROMPT_TEMPLATE } from "../config/directorCore";
import { UnifiedDirectorOutputSchema, UnifiedDirectorOutput } from "./schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger, GameState } from "../types";
import { INITIAL_LEDGER } from "../constants";
import { callGeminiWithRetry } from "../utils/apiRetry";
import { selectNarratorMode, NARRATOR_VOICES } from '../services/narratorEngine';
import { LORE_CONSTITUTION } from '../config/loreInjection';
import { TensionManager } from "../services/TensionManager";

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

// --- HELPER: AGENCY/LUCK CHECK ---
function checkCriticalSuccess(ledger: YandereLedger): boolean {
    // Base 5% chance, +1% for every 10 Hope points
    const chance = 0.05 + (ledger.hopeLevel / 1000);
    return Math.random() < chance;
}

// --- HELPER FUNCTIONS FOR AGENT LOGIC ---

function getSpecificDriveInstruction(archetype: string): string {
  switch (archetype) {
    case 'The Sadist': 
      return "Prioritize 'public_action' that involves kinetic punishment or physical impact. Violence is your language.";
    case 'The Nurse': 
      return "Implement 'Weaponized Nurturing'. Trade 'Health' for 'Secrets'. Emphasize gentle touch contrasted with cold questions.";
    case 'The Zealot': 
      return "Prioritize validation. Quote the 'Codex of Yala' to justify actions. Hesitate physically, then overcompensate verbally.";
    case 'The Yandere': 
      return "Monitor 'Jealousy'. If Subject interacts with others, trigger 'Purification Ritual'. Refer to Subject as 'My Project' or 'Beloved'.";
    case 'The Dissident': 
      return "Check 'Public_Visibility'. If TRUE: Be cynical/cruel. If FALSE: Be helpful/conspiratorial (Code-Switching).";
    default: 
      return "Prioritize 'public_action' that actively demonstrates your dominance and competence.";
  }
}

function getSpecificWeaknessInstruction(archetype: string): string {
  switch (archetype) {
    case 'The Zealot': 
      return "THE TELL: You MUST show visible hesitation (a flinch, a stutter, looking away) when ordering violence, then immediately overcompensate with loud scripture.";
    case 'The Nurse': 
      return "THE TELL: The 'Surgical Question'. Embed interrogation questions within soothing medical talk ('Does this hurt?... So, what did Darius tell you?').";
    case 'The Yandere': 
      return "THE TELL: The 'Dead Eyes Switch'. Snap from 'Dere' (Sweet/Adoring) to 'Yan' (Homicidal) instantly if defied or jealous.";
    case 'The Dissident': 
      return "THE TELL: 'Code-Switching'. Use a harsh, cynical voice in public ('Pathetic worm') and an urgent, whispered voice in private.";
    case 'The Sadist': 
      return "THE TELL: The 'Predatory Giggle'. You MUST betray your enjoyment of the pain. A smile you can't hide.";
    default: 
      return "Ensure your secret weakness acts as a visible 'tell' or constraint on your action.";
  }
}

function getBehavioralQuirk(archetype: string, emotionalState: any): string {
  const { paranoia, desperation, confidence } = emotionalState || { paranoia: 0, desperation: 0, confidence: 0 };
  
  switch(archetype) {
    case 'The Yandere': // Kaelen
      if (paranoia > 0.6) return "Quirk: Fidgets neurotically with a lock of hair or her ribbon choker.";
      if (confidence > 0.7) return "Quirk: Her eyes go completely dead/flat ('Yan' switch) while smiling sweetly.";
      return "Quirk: Clutches a small token of the Subject tightly.";
      
    case 'The Zealot': // Elara
      if (desperation > 0.5) return "Quirk: Clasps hands together so tightly the knuckles turn white to hide shaking.";
      if (confidence > 0.6) return "Quirk: Stands with unnatural, brittle rigidity, chin lifted too high.";
      return "Quirk: Touches the Codex/Rulebook like a talisman.";
      
    case 'The Dissident': // Rhea
      if (paranoia > 0.5) return "Quirk: Eyes dart to the exits; taps ash from cigarette nervously.";
      if (confidence > 0.6) return "Quirk: Rolls eyes visibly or leans back in a posture of exaggerated boredom.";
      return "Quirk: Lowers voice and leans in slightly (Code-Switching).";
      
    case 'The Nurse': // Anya
      if (confidence > 0.7) return "Quirk: Idly toys with a medical instrument (syringe/thermometer) against her lip.";
      return "Quirk: Adjusts her coat to subtly reveal or conceal skin, modulating her 'warmth'.";
      
    case 'The Sadist': // Petra (if simulated as prefect)
      if (confidence > 0.8) return "Quirk: Bounces on heels, unable to contain kinetic energy.";
      return "Quirk: Taps foot impatiently, checking for a reaction.";
      
    default:
      return "Quirk: Maintains a specific, recurring posture.";
  }
}

/**
 * Derives a specific short-term goal for a prefect based on current ledger and context.
 */
function deriveShortTermGoal(prefect: PrefectDNA, ledger: YandereLedger, rivals: string[], currentLocation: string): string {
  const { traumaLevel, complianceScore, hopeLevel, physicalIntegrity, shamePainAbyssLevel, arousalLevel } = ledger;
  
  // High Trauma Reactivity (Global)
  if (traumaLevel > 85) {
      if (prefect.archetype === 'The Nurse') return "Identify the Subject's physiological shock (nausea, trembling) and exploit it under the guise of medical care. Administer a 'calming' agent that increases suggestibility.";
      if (prefect.archetype === 'The Sadist') return "Mock the Subject's pathetic posture (guarding, collapsing) and deliver a final 'correction'. Verify if the subject is truly broken.";
      if (prefect.archetype === 'The Zealot') return "Demand the Subject stand straight despite the pain, citing the 'Posture of Penitence'. Panic internally if they collapse.";
      if (prefect.archetype === 'The Yandere') return "Panic at the subject's damage. 'Protect' them by isolating them from everyone else violently.";
  }

  // NEW: Clinic-specific behavior for The Nurse
  if (prefect.archetype === 'The Nurse' && currentLocation === 'loc_infirmary') {
      // Prioritize medical examination for secrets or status impact
      if (physicalIntegrity < 90 || traumaLevel > 30) {
          return "Perform an 'intimate' medical examination to uncover a physiological secret or exploit a vulnerability (e.g., prostate sensitivity, hidden injuries). Frame it as necessary care. Offer a 'pain-relief' sedative that induces truth-telling. Update ledger (physicalIntegrity, arousalLevel, shamePainAbyssLevel) and add a new 'add_subject_secret' KGot mutation.";
      }
      return "Conduct a 'routine' medical check-up, subtly invading personal space and asking intrusive questions under the guise of health monitoring. Try to lower hopeLevel or increase complianceScore.";
  }


  switch (prefect.archetype) {
    case 'The Yandere': // Kaelen
      if (rivals.length > 0) return "Aggressively insert yourself between the Subject and the other Prefect to block their access. Glare at the rival.";
      if (complianceScore < 30) return "Threaten the Subject with a 'purification' ritual if they do not look at you immediately. Use a sweet, terrifying voice.";
      if (hopeLevel > 50) return "Destroy a small object of hope belonging to the Subject (or a memory), then claim you did it for their own good.";
      if (arousalLevel && arousalLevel > 40) return "Touch the Subject to claim ownership. Whisper that only you understand their 'dirty' body.";
      return "Touch the Subject to claim ownership and whisper a possessive secret that terrifies them.";
      
    case 'The Zealot': // Elara
      if (traumaLevel < 40) return "Find a minor infraction (posture, eye contact) and blow it out of proportion to justify immediate punishment. Cite specific Codex rules.";
      if (hopeLevel > 60) return "Crush the Subject's hope by citing the inevitability of the Codex's final chapter. Be loud to cover your own doubt.";
      if (complianceScore > 80) return "Praise the Subject awkwardly, then recoil as if you've done something wrong. Resume strictness immediately.";
      if (shamePainAbyssLevel > 50) return "Lecture the subject on the 'virtue of shame'. Avoid making eye contact while punishing.";
      return "Demand the Subject recite a rule from the Codex, then physically correct their tone.";
      
    case 'The Nurse': // Anya (Fallback if not in Infirmary)
      if (physicalIntegrity < 60) return "Use a medical check-up to invade personal space. Whisper a deal: 'I can stop the pain if you tell me a secret about Elara.'";
      if (traumaLevel > 80) return "Offer a sedative that is actually a truth serum, framed as mercy. Record their delirious ramblings.";
      if (shamePainAbyssLevel > 60) return "Humiliate the subject under the guise of a 'hygiene inspection'.";
      return "Perform a 'preventative' examination that is humiliating but non-violent. Establish reliance.";
      
    case 'The Dissident': // Rhea
      if (rivals.includes('The Zealot')) return "Mock The Zealot's rigid adherence to rules to undermine her authority in front of the Subject. Be cynical.";
      if (hopeLevel < 20) return "Drop a physical token (key, note) near the Subject while berating them verbally. 'Clumsy idiot.'";
      if (complianceScore > 90) return "Look at the subject with disgust for their weakness. 'Is there anything left in there?'";
      return "Perform a cruel act for the cameras, but give the Subject a signal (wink, squeeze) that it is performance.";
      
    case 'The Sadist':
      if (complianceScore > 90) return "Invent a reason to punish the Subject anyway, proving that obedience does not guarantee safety. Laugh about it.";
      if (physicalIntegrity > 90) return "The subject looks too pristine. 'Fix' that immediately.";
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
  history: string[],
  currentLocation: string // Pass currentLocation explicitly
): string {
  const rivalsInScene = activePrefects.map(p => p.archetype);

  // Inject Trauma Observation Context
  let traumaObservation = "";
  if (ledger.traumaLevel > 70) {
      traumaObservation = `\n**SUBJECT PHYSICAL STATE:** The Subject is physically compromised. He is likely shaking, guarding his groin, or on the verge of collapse (Nausea/Shock). Prefects MUST acknowledge this weakness (either mocking it, analyzing it, or exploiting it).`;
  }

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
    const behavioralQuirk = getBehavioralQuirk(prefect.archetype, emotionalState);
    const sceneGoal = deriveShortTermGoal(prefect, ledger, rivalsInScene.filter(r => r !== prefect.archetype), currentLocation); // Pass currentLocation

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
2. **THE TELL (MANDATORY):** ${weaknessInstr}
3. **BEHAVIORAL QUIRK:** ${behavioralQuirk} (Include this detail in the narrative or internal monologue).
4. **SOCIAL DYNAMICS (RELATIONAL PRESSURE):** ${socialMandate}

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

**THEMATIC RESONANCE (MANDATORY DIALOGUE LAYER):**
- **Control:** Characters must speak with the assumption of absolute ownership. Use possessive pronouns regarding the Subject.
- **Submission:** Frame the Subject's suffering as a service they are providing or a lesson they are learning. "Thank you for this data."
- **Corruption of Innocence:** Violence must be framed as "fixing" or "cleansing." The perpetrator believes they are benevolent. "I am just engaging the mechanism."

**PLAYER STATE FOR CONTEXT:**
- Trauma: ${ledger.traumaLevel}/100
- Compliance: ${ledger.complianceScore}/100
- Hope: ${ledger.hopeLevel}/100
- Current Location: ${currentLocation}
${traumaObservation}

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
    // RPM OPTIMIZATION:
    // gemini-3-pro-preview is rate limited to 2 RPM on free tier.
    // gemini-2.5-flash is 15 RPM.
    // We default to gemini-2.5-flash but enable Thinking Config to maintain depth.
    
    // NOTE: Flash 2.5 supports Thinking Config.
    const modelId = 'gemini-2.5-flash'; // Fixed to gemini-2.5-flash as per SOTA instructions
    const useThinking = !isLiteMode; // Only use thinking for "Pro" feel, even on Flash model

    console.log(`⚡ [Unified Director] Starting System 2 Deep Think using ${modelId} (Thinking: ${useThinking})...`);
    
    // 1. Initialize Systems
    const controller = new KGotController(currentGraphData);
    const graphSnapshot = controller.getGraph();
    // Fix: Ensure `ledger` also contains `currentLocation` for consistent access
    const ledger: YandereLedger & { currentLocation?: string } = {
        ...(graphSnapshot.nodes['Subject_84']?.attributes?.ledger || INITIAL_LEDGER),
        currentLocation: graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || "The Calibration Chamber"
    };
    
    // 2. Select Narrator Mode
    const currentNarratorMode = selectNarratorMode(ledger);
    const voiceProfile = NARRATOR_VOICES[currentNarratorMode];

    // 2.5 Calculate Fortune (Agency Injection)
    const isCriticalSuccess = checkCriticalSuccess(ledger);
    const fortuneInjection = isCriticalSuccess 
      ? `**CRITICAL AGENCY EVENT:** The Subject's Hope has triggered a rare moment of clarity/luck. 
         OVERRIDE standard Trauma physics. Allow the player's action ("${playerInput}") to SUCCEED even if stats suggest failure. 
         Narrate this as a "Miracle of Will" or a "System Glitch".`
      : `STANDARD PHYSICS: Apply standard Trauma/Compliance constraints. If Trauma > 90, creative resistance should fail or be twisted.`;

    // 3. Build unified prompt that includes BOTH prefect simulation AND narrative synthesis
    const prefectContextBlock = buildPrefectContextBlock(activePrefects, ledger, playerInput, history, ledger.currentLocation || "The Calibration Chamber"); // Pass currentLocation
    
    // 3.5 Calculate Narrative Beat (Pacing) - NEW
    const turnCount = graphSnapshot.global_state.turn_count;
    const currentBeat = TensionManager.calculateNarrativeBeat(turnCount, 0); // Assuming delta 0 for now
    const beatInstruction = TensionManager.getBeatInstructions(currentBeat);

    // 3.6 Get Spotlight Context - NEW
    const spotlight = controller.getNarrativeSpotlight(
      "Subject_84",
      ledger.currentLocation || "The Calibration Chamber",
      activePrefects.map(p => p.id)
    );

    // 3.7 Replace Placeholders in Master Template - NEW
    const unifiedPrompt = DIRECTOR_MASTER_PROMPT_TEMPLATE
      .replace('{{narrative_beat}}', currentBeat)
      .replace('{{beat_instruction}}', beatInstruction)
      .replace('{{ledger}}', JSON.stringify(ledger, null, 2))
      .replace('{{narrative_spotlight}}', JSON.stringify(spotlight, null, 2))
      .replace('{{active_prefects}}', JSON.stringify(activePrefects.map(p => ({ id: p.id, archetype: p.archetype, drive: p.drive, favor: p.favorScore })), null, 2))
      .replace('{{history}}', history.slice(-3).join('\n---\n'))
      .replace('{{player_input}}', playerInput);
    
    const ai = getAI();
    const response = await callGeminiWithRetry<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: modelId, 
        contents: [{ role: 'user', parts: [{ text: unifiedPrompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: UnifiedDirectorOutputSchema,
          temperature: 1.0, // Fixed to 1.0 as per SOTA instructions
          // Enable Deep Think via Thinking Config for Gemini 2.5 Flash
          // Budget set to 1024 for speed/efficiency while maintaining reasoning quality
          thinkingConfig: useThinking ? { thinkingBudget: 1024 } : undefined 
        }
      }),
      "Unified Director"
    );
    
    const outputText = response.text || "{}";
    let unifiedOutput: UnifiedDirectorOutput;

    // Direct JSON parsing as output is guaranteed valid by schema
    try {
      unifiedOutput = JSON.parse(outputText);
    } catch (parseError) {
      console.error("Failed to parse Unified Director output JSON:", parseError);
      throw new Error(`Invalid JSON response from AI: ${outputText.substring(0, 200)}...`);
    }

    // 4. Apply mutations
    if (unifiedOutput.kgot_mutations) {
      controller.applyMutations(unifiedOutput.kgot_mutations);
    }
    if (unifiedOutput.ledger_update) {
      // Fix: Call updateLedger method on the controller instance
      controller.updateLedger('Subject_84', unifiedOutput.ledger_update);
    }
    
    // 5. Combine somatic + narrative
    const combinedNarrative = `
<span class="somatic-nova">${unifiedOutput.somatic_state?.impact_sensation || ""}</span>

<span class="somatic-void">${unifiedOutput.somatic_state?.internal_collapse || ""}</span>

${unifiedOutput.narrative_text}
`;
    
    // Construct the Cognitive Graph trace log showing the Deep Think steps
    // Updated to reflect the new reasoning_trace fields
    const cognitiveTrace = `
SYSTEM 2 REASONING TRACE (${modelId}):
-------------------------
[1] CAUSAL ANALYSIS:
${unifiedOutput.reasoning_trace.analysis}

[2] BRANCH HYPOTHESES:
${unifiedOutput.reasoning_trace.hypotheses.map((h, i) => `   (${['A', 'B', 'C'][i]}) ${h}`).join('\n')}

[3] EVALUATION & SELECTION:
${unifiedOutput.reasoning_trace.evaluation}

[4] SELF-CRITIQUE:
${unifiedOutput.reasoning_trace.self_critique}

[5] SELECTED PATH:
${unifiedOutput.reasoning_trace.selected_path}
    `.trim();

    return {
      narrative: combinedNarrative,
      script: unifiedOutput.script, // NEW: Pass script
      visualPrompt: unifiedOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: unifiedOutput.choices || ["Endure", "Observe"],
      thoughtProcess: cognitiveTrace,
      state_updates: unifiedOutput.ledger_update,
      audioCues: unifiedOutput.audio_cues,
      psychosisText: unifiedOutput.psychosis_text,
      prefectSimulations: unifiedOutput.prefect_simulations,
      audioMarkup: unifiedOutput.audio_markup
    };
    
  } catch (error: any) {
    console.error("Unified Director Failed:", error);
    const errorMessage = error.message || "Unknown AI error.";
    return {
      narrative: `The Loom shudders. A neural-symbolic disconnect. (${errorMessage})`,
      script: [{ speaker: "System", text: "CONNECTION LOST. REALITY FRACTURE DETECTED." }],
      visualPrompt: "Static. Glitching pixels.",
      updatedGraph: currentGraphData,
      choices: ["Attempt to re-stabilize neural link"],
      thoughtProcess: `Error: ${errorMessage}`,
      state_updates: {}, 
      audioCues: [],
      psychosisText: "REALITY_FLICKERS::PATTERN_BREAK",
      prefectSimulations: [], // Ensure this is also returned
      audioMarkup: undefined,
    };
  }
}
