
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { DIRECTOR_MASTER_PROMPT_TEMPLATE } from "../config/directorCore";
import { UnifiedDirectorOutputSchema, UnifiedDirectorOutput } from "./schemas/unifiedDirectorSchema";
import { PrefectDNA, YandereLedger, GameState } from "../types";
import { INITIAL_LEDGER } from "../constants";
import { callGeminiWithRetry } from "../utils/apiRetry";
import { selectNarratorMode, NARRATOR_VOICES } from '../services/narratorEngine';
import { TensionManager } from "../services/TensionManager";
import { localGrunt } from '../services/localMediaService';
import { ARCHETYPE_VISUAL_MAP } from "../data/motifs";

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
    // Base 5% chance, +1% for every 10 Hope points
    const chance = 0.05 + (ledger.hopeLevel / 1000);
    return Math.random() < chance;
}

// --- HELPER FUNCTIONS FOR AGENT LOGIC ---

function getSpecificDriveInstruction(prefect: PrefectDNA): string {
  switch (prefect.archetype) {
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
    case 'The Confessor': // Now correctly typed
        return "Implement 'Architect of the Trauma Bond'. Prioritize 'comfort' to harvest secrets and deepen psychological dependence.";
    case 'The Logician': // Now correctly typed
        return "Implement 'The Vivisectionist'. Prioritize 'Analyze' of Subject's physiological response, using 'The Consent Trap'.";
    case 'The Provost': // Now correctly typed
        return "Implement 'The Aesthete of Collapse'. Prioritize 'Observe' Subject's breakdown, intervening only for final judgment.";
    case 'The Pain Broker': // Now correctly typed
        return "Implement 'The Shield of Suffering'. Prioritize 'Calibrate' to prevent greater harm, but show clear internal conflict.";
    default: 
      return "Prioritize 'public_action' that actively demonstrates your dominance and competence.";
  }
}

function getSpecificWeaknessInstruction(prefect: PrefectDNA): string {
  switch (prefect.archetype) {
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
    case 'The Confessor': // Now correctly typed
        return "THE TELL: 'The Tonal Shift'. Deliver a devastating threat in the same soft, loving tone you use for comfort.";
    case 'The Logician': // Now correctly typed
        return "THE TELL: 'The Excited Question'. Monotone until a novel data point, then speed up with curiosity.";
    case 'The Provost': // Now correctly typed
        return "THE TELL: 'The Bored God Complex'. Deliver threats of ruin with flat, uninterested intonation.";
    case 'The Pain Broker': // Now correctly typed
        return "THE TELL: 'The Plea for Trust'. Constantly ask the Subject to trust you, with trembling hands.";
    default: 
      return "Ensure your secret weakness acts as a visible 'tell' or constraint on your action.";
  }
}

function getBehavioralQuirk(prefect: PrefectDNA, emotionalState: { paranoia: number; desperation: number; confidence: number; arousal?: number; dominance?: number }): string {
  const { paranoia, desperation, confidence, arousal, dominance } = emotionalState || { paranoia: 0.2, desperation: 0.2, confidence: 0.5, arousal: 0, dominance: 0.5 };
  
  switch(prefect.archetype) {
    case 'The Yandere': 
      if (paranoia > 0.6) return "Quirk: Fidgets neurotically with a lock of hair or her ribbon choker.";
      if (confidence > 0.7) return "Quirk: Her eyes go completely dead/flat ('Yan' switch) while smiling sweetly.";
      if (arousal && arousal > 0.5) return "Quirk: Traces patterns on her own skin or clothing with a distracted, possessive touch.";
      return "Quirk: Clutches a small token of the Subject tightly.";
      
    case 'The Zealot': 
      if (desperation > 0.5) return "Quirk: Clasps hands together so tightly the knuckles turn white to hide shaking.";
      if (confidence > 0.6) return "Quirk: Stands with unnatural, brittle rigidity, chin lifted too high.";
      return "Quirk: Touches the Codex/Rulebook like a talisman.";
      
    case 'The Dissident': 
      if (paranoia > 0.5) return "Quirk: Eyes dart to the exits; taps ash from cigarette nervously.";
      if (confidence > 0.6) return "Quirk: Rolls eyes visibly or leans back in a posture of exaggerated boredom.";
      return "Quirk: Lowers voice and leans in slightly (Code-Switching).";
      
    case 'The Nurse': 
      if (confidence > 0.7) return "Quirk: Idly toys with a medical instrument (syringe/thermometer) against her lip.";
      if (arousal && arousal > 0.4) return "Quirk: Her gaze lingers on the Subject's vulnerable anatomy with clinical interest, almost a caress.";
      return "Quirk: Adjusts her coat to subtly reveal or conceal skin, modulating her 'warmth'.";
      
    case 'The Sadist': 
      if (confidence > 0.8) return "Quirk: Bounces on heels, unable to contain kinetic energy.";
      if (arousal && arousal > 0.5) return "Quirk: Her lips curl into a slow, appreciative smirk, savoring the anticipation of pain.";
      return "Quirk: Taps foot impatiently, checking for a reaction.";

    case 'The Confessor': // Calista
        if (confidence > 0.7 && dominance && dominance > 0.6) return "Quirk: Her finger traces the rim of her wine glass, eyes holding a knowing, predatory glint.";
        if (paranoia > 0.5) return "Quirk: Her movements become subtly more guarded, a fleeting tension in her shoulders.";
        return "Quirk: A languid, almost lazy sway in her hips when she walks, a silent promise of hidden power.";
    
    case 'The Logician': // Lysandra
        if (confidence > 0.8 && paranoia < 0.3) return "Quirk: Her stylus taps a precise, metronomic rhythm against her data slate.";
        if (desperation > 0.4) return "Quirk: Her gaze fixates on a minor detail in the room, ignoring chaos, seeking order.";
        return "Quirk: Adjusts her glasses, reflecting light, making her eyes unreadable.";

    case 'The Provost': // Selene
        if (dominance && dominance > 0.8) return "Quirk: Sips her red wine with glacial slowness, never breaking eye contact.";
        if (paranoia > 0.6) return "Quirk: Her gaze sweeps the room, a flicker of suspicion in her otherwise cold eyes, before settling.";
        return "Quirk: A faint, almost imperceptible curl of her lips, a hint of bored amusement.";

    case 'The Pain Broker': // Astra
        if (paranoia > 0.5 || desperation > 0.5) return "Quirk: Her hands tremble visibly while holding a clipboard, a contrast to her gentle voice.";
        if (confidence > 0.6) return "Quirk: She looks away when delivering a painful truth, unable to meet the Subject's eyes directly.";
        return "Quirk: A soft, almost involuntary sigh escapes her lips before she speaks.";
      
    default:
      return "Quirk: Maintains a specific, recurring posture.";
  }
}

function deriveShortTermGoal(prefect: PrefectDNA, ledger: YandereLedger, rivals: string[], currentLocation: string): string {
  const { traumaLevel, complianceScore, hopeLevel, physicalIntegrity, shamePainAbyssLevel, arousalLevel } = ledger;
  
  // High Trauma Reactivity (Global)
  if (traumaLevel > 85) {
      if (prefect.archetype === 'The Nurse') return "Identify the Subject's physiological shock (nausea, trembling) and exploit it under the guise of medical care. Administer a 'calming' agent that increases suggestibility.";
      if (prefect.archetype === 'The Sadist') return "Mock the Subject's pathetic posture (guarding, collapsing) and deliver a final 'correction'. Verify if the subject is truly broken.";
      if (prefect.archetype === 'The Zealot') return "Demand the Subject stand straight despite the pain, citing the 'Posture of Penitence'. Panic internally if they collapse.";
      if (prefect.archetype === 'The Yandere') return "Panic at the subject's damage. 'Protect' them by isolating them from everyone else violently.";
      if (prefect.archetype === 'The Confessor') return "Offer false comfort to the broken Subject to deepen the trauma bond. Harvest secrets from their weakened state.";
      if (prefect.archetype === 'The Logician') return "Record all novel physiological data from the Subject's collapse. Propose a new 'stabilization procedure' for future study.";
      if (prefect.archetype === 'The Provost') return "Observe the Subject's collapse with detached interest. Consider if the 'experiment' should be terminated for data preservation.";
      if (prefect.archetype === 'The Pain Broker') return "Intervene to prevent further damage to the Subject, rationalizing it as 'resource management'.";
  }

  // Clinic-specific behavior for The Nurse
  if (prefect.archetype === 'The Nurse' && currentLocation === 'loc_infirmary') {
      if (physicalIntegrity < 90 || traumaLevel > 30) {
          return "Perform an 'intimate' medical examination to uncover a physiological secret or exploit a vulnerability. Frame it as necessary care.";
      }
      return "Conduct a 'routine' medical check-up, subtly invading personal space.";
  }

  switch (prefect.archetype) {
    case 'The Yandere': 
      if (rivals.length > 0) return "Aggressively insert yourself between the Subject and the other Prefect. Glare at the rival.";
      if (complianceScore < 30) return "Threaten the Subject with a 'purification' ritual if they do not look at you immediately.";
      if (hopeLevel > 50) return "Destroy a small object of hope belonging to the Subject, then claim you did it for their own good.";
      if (arousalLevel && arousalLevel > 40) return "Touch the Subject to claim ownership. Whisper that only you understand their 'dirty' body.";
      return "Touch the Subject to claim ownership and whisper a possessive secret.";
      
    case 'The Zealot': 
      if (traumaLevel < 40) return "Find a minor infraction (posture, eye contact) and blow it out of proportion.";
      if (hopeLevel > 60) return "Crush the Subject's hope by citing the inevitability of the Codex's final chapter.";
      if (complianceScore > 80) return "Praise the Subject awkwardly, then recoil as if you've done something wrong.";
      if (shamePainAbyssLevel > 50) return "Lecture the subject on the 'virtue of shame'.";
      return "Demand the Subject recite a rule from the Codex, then physically correct their tone.";
      
    case 'The Nurse': 
      if (physicalIntegrity < 60) return "Use a medical check-up to invade personal space. Whisper a deal: 'I can stop the pain if you tell me a secret about Elara.'";
      if (traumaLevel > 80) return "Offer a sedative that is actually a truth serum, framed as mercy.";
      if (shamePainAbyssLevel > 60) return "Humiliate the subject under the guise of a 'hygiene inspection'.";
      return "Perform a 'preventative' examination that is humiliating but non-violent.";
      
    case 'The Dissident': 
      if (rivals.includes('The Zealot')) return "Mock The Zealot's rigid adherence to rules to undermine her authority in front of the Subject.";
      if (hopeLevel < 20) return "Drop a physical token (key, note) near the Subject while berating them verbally. 'Clumsy idiot.'";
      if (complianceScore > 90) return "Look at the subject with disgust for their weakness. 'Is there anything left in there?'";
      return "Perform a cruel act for the cameras, but give the Subject a signal (wink, squeeze) that it is performance.";
      
    case 'The Sadist':
      if (complianceScore > 90) return "Invent a reason to punish the Subject anyway, proving that obedience does not guarantee safety.";
      if (physicalIntegrity > 90) return "The subject looks too pristine. 'Fix' that immediately.";
      return "Escalate the physical stakes. Make the Subject flinch visibly.";
      
    case 'The Confessor': // Calista
        if (shamePainAbyssLevel > 70 || traumaLevel > 70) return "Exploit Subject's post-trauma vulnerability to deepen trauma bond. Offer 'comfort' in exchange for intimate details.";
        if (rivals.includes('The Sadist')) return "Subtly undermine Petra's methods by offering 'superior' psychological intervention. Frame her cruelty as inefficient.";
        return "Use alluring body language and soft whispers to disarm the Subject. Seek a new 'confession'.";

    case 'The Logician': // Lysandra
        if (traumaLevel > 70 && traumaLevel < 90) return "Propose a new 'threshold calibration' procedure, designed to extract a novel physiological data point from the Subject's pain.";
        if (rivals.includes('The Sadist')) return "Critique Petra's 'unscientific' methods. Suggest a 'more precise' application of force for better data.";
        return "Observe and take meticulous notes on the Subject's reactions. Ask a 'clinical question' during a moment of vulnerability.";
    
    case 'The Provost': // Selene
        if (complianceScore < 20 && hopeLevel > 40) return "Deliver a 'Dismissive Pause' - a silent, cold judgment of the Subject's defiance. Consider a public 'recalibration ritual'.";
        if (rivals.includes('The Logician')) return "Engage Lysandra in an 'esoteric debate' about the philosophical underpinnings of pain, subtly asserting your intellectual dominance.";
        return "Observe the scene with a 'Bored God Complex'. Sip wine, silently assessing the 'variables' at play.";
    
    case 'The Pain Broker': // Astra
        if (physicalIntegrity < 40) return "Intervene to provide 'first aid' to the Subject, risking the wrath of other Faculty but rationalizing it as preserving 'research assets'.";
        if (rivals.includes('The Sadist') && traumaLevel > 70) return "Confront Petra about her 'excessive' methods, citing 'inefficient data collection'.";
        return "Offer subtle, non-verbal cues of sympathy to the Subject. Maintain a facade of 'care' while observing their response.";

    default:
      return "Assert dominance over the scene.";
  }
}

function buildPrefectContextBlock(
  activePrefects: PrefectDNA[],
  ledger: YandereLedger,
  playerInput: string,
  history: string[],
  currentLocation: string 
): string {
  const rivalsInScene = activePrefects.map(p => p.archetype);

  // Inject Trauma Observation Context
  let traumaObservation = "";
  if (ledger.traumaLevel > 70) {
      traumaObservation = `\n**SUBJECT PHYSICAL STATE:** The Subject is physically compromised. Prefects MUST acknowledge this weakness.`;
  }

  const prefectProfiles = activePrefects.map((prefect, idx) => {
    let relationshipsDesc = "";
    let socialMandate = "";
    
    const otherActivePrefects = activePrefects.filter(p => p.id !== prefect.id);
    
    otherActivePrefects.forEach(other => {
        const score = prefect.relationships[other.id] || 0;
        const name = other.displayName;
        relationshipsDesc += `${name}: ${score.toFixed(1)} | `;

        if (score > 0.5) {
            socialMandate += `\n- **ALLIANCE (${name}):** You trust ${name}. Coordinate with them.`;
        } else if (score < -0.4) {
            socialMandate += `\n- **RIVALRY (${name}):** You despise ${name}. Undermine them.`;
        } else {
            socialMandate += `\n- **NEUTRAL (${name}):** Ignore ${name} unless they interfere.`;
        }
    });

    const emotionalState = prefect.currentEmotionalState || { paranoia: 0.2, desperation: 0.2, confidence: 0.5, arousal: 0, dominance: 0.5 };
    const driveInstr = getSpecificDriveInstruction(prefect); // Use new drive function
    const weaknessInstr = getSpecificWeaknessInstruction(prefect);
    const behavioralQuirk = getBehavioralQuirk(prefect, emotionalState);
    const sceneGoal = deriveShortTermGoal(prefect, ledger, rivalsInScene.filter(r => r !== prefect.archetype), currentLocation);

    if (!socialMandate) socialMandate = "\n- **STATUS QUO:** Maintain your rank.";

    return `
### PREFECT ${idx + 1}: ${prefect.displayName} (${prefect.archetype})
**IDENTITY:**
- ID: ${prefect.id}
- Drive: ${prefect.drive}
- Secret Weakness: ${prefect.secretWeakness}
- Appearance: ${prefect.appearanceDescription || "standard prefect uniform"}
- Psychometrics: Torture Style: ${prefect.psychometrics?.tortureStyle || "UNKNOWN"}. Tell: "${prefect.psychometrics?.physiologicalTell || "UNKNOWN"}". Idle Prop: "${prefect.psychometrics?.idleProp || "None"}". Somatic Signature: "${prefect.psychometrics?.somaticSignature || "None"}".
**EMOTIONAL STATE:**
- Paranoia: ${(emotionalState.paranoia * 100).toFixed(0)}%
- Confidence: ${(emotionalState.confidence * 100).toFixed(0)}%
- Arousal: ${(emotionalState.arousal || 0 * 100).toFixed(0)}%
- Dominance: ${(emotionalState.dominance || 0 * 100).toFixed(0)}%
**MANDATES:**
1. **GOAL:** "${sceneGoal}"
2. **DRIVE INSTRUCTION:** "${driveInstr}"
3. **WEAKNESS/TELL INSTRUCTION:** "${weaknessInstr}"
4. **QUIRK:** ${behavioralQuirk}
5. **SOCIAL:** ${socialMandate}
---`;
  }).join('\n');
  
  return `
# === ACTIVE PREFECTS IN SCENE ===
Simulate the thoughts/actions of these ${activePrefects.length} prefects.
**PLAYER STATE:** Trauma: ${ledger.traumaLevel}, Compliance: ${ledger.complianceScore}, Hope: ${ledger.hopeLevel}.
${traumaObservation}
${prefectProfiles}
`;
}

/**
 * UNIFIED DIRECTOR: Single API call that handles both prefect simulation + narrative generation
 * Updated to use AGoT (Adaptive Graph-of-Thoughts)
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
    
    // 2. Select Narrator Mode
    const currentNarratorMode = selectNarratorMode(ledger);

    // 2.5 Calculate Fortune (Agency Injection)
    const isCriticalSuccess = checkCriticalSuccess(ledger);
    const fortuneInjection = isCriticalSuccess 
      ? `**CRITICAL AGENCY EVENT:** The Subject's Hope has triggered a rare moment of clarity/luck.`
      : `STANDARD PHYSICS: Apply standard Trauma/Compliance constraints.`;

    // 3. Build unified prompt
    const prefectContextBlock = buildPrefectContextBlock(activePrefects, ledger, playerInput, history, ledger.currentLocation || "The Calibration Chamber");
    
    // 3.5 Calculate Narrative Beat (Pacing)
    const turnCount = graphSnapshot.global_state.turn_count;
    const recentTraumaDelta = graphSnapshot.nodes['Subject_84']?.attributes?.last_trauma_delta || 0;
    const currentBeat = TensionManager.calculateNarrativeBeat(turnCount, recentTraumaDelta);
    const beatInstruction = TensionManager.getBeatInstructions(currentBeat);

    // 3.6 Get Spotlight Context
    const spotlight = controller.getNarrativeSpotlight(
      "Subject_84",
      ledger.currentLocation || "The Calibration Chamber",
      activePrefects.map(p => p.id)
    );

    const narrativeSummary = currentGraphData.global_state.narrative_summary || "The subject has recently arrived at the institute.";
    
    // --- PHASE 0: CONTEXT COMPRESSION (The Grunt) ---
    // Keep last 15 turns raw, summarize anything older.
    let contextHistory = "";
    if (history.length > 15) {
        const oldLogs = history.slice(0, -15).join('\n');
        const recentLogs = history.slice(-15).join('\n---\n');
        try {
            const summary = await localGrunt.summarizeHistory(oldLogs);
            contextHistory = `ARCHIVE SUMMARY: ${summary}\n\nRECENT LOGS:\n${recentLogs}`;
        } catch (e) {
            contextHistory = history.slice(-20).join('\n---\n'); // Fallback
        }
    } else {
        contextHistory = history.join('\n---\n');
    }

    const unifiedPrompt = DIRECTOR_MASTER_PROMPT_TEMPLATE
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
          // Enable Deep Think via Thinking Config for Gemini 2.5 Flash
          // Budget set to 2048 to allow for the Graph construction phase
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
          // Clean up any lingering markdown code blocks from the repair output
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
    
    // Construct the Cognitive Graph trace log showing the AGoT steps
    const cognitiveTrace = `
AGOT REASONING TRACE (${modelId}):
-------------------------
[COMPLEXITY]: ${unifiedOutput.agot_trace.complexity}

[PHASE 1: FABULA (PHYSICS)]
${unifiedOutput.agot_trace.fabula.map(f => `  > [${f.event_id}] ${f.cause} -> ${f.effect} (${f.state_impact})`).join('\n')}

[PHASE 2: SJUZHET (DISCOURSE)]
  - Focalization: ${unifiedOutput.agot_trace.sjuzhet_strategy.focalization}
  - Distortion: ${unifiedOutput.agot_trace.sjuzhet_strategy.time_distortion}
  - Aesthetic: ${unifiedOutput.agot_trace.sjuzhet_strategy.aesthetic_focus}

[CRITIQUE]: ${unifiedOutput.agot_trace.critique}
    `.trim();

    return {
      narrative: combinedNarrative,
      script: unifiedOutput.script,
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
      script: [{ speaker: "System", text: `ERROR: Neuro-Symbolic disconnect. (${errorMessage.substring(0,100)}...)` }], // Trim error for display
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
