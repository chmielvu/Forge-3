
import { GoogleGenAI, Type } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { VISUAL_MANDATE } from "../config/visualMandate";
import { selectNarratorMode, NARRATOR_VOICES } from "../services/narratorEngine";
import { PrefectDecision, YandereLedger } from "../types";
import { SYSTEM_INSTRUCTION_ROOT, LORE_CONSTITUTION } from "../config/loreInjection";
import { MagellanController } from "./magellan";
import { INITIAL_LEDGER } from "../constants";

// ==================== CONFIGURATION ====================

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

// ==================== SCHEMAS ====================

const DirectorOutputSchema = {
  type: Type.OBJECT,
  properties: {
    thought_signature: { type: Type.STRING, description: "I-MCTS Result: The chosen narrative path (Trauma, Subversion, or Novelty) and why." },
    
    // STRUCTURED NARRATIVE: The Somatic Cascade (Grammar of Suffering)
    somatic_state: {
      type: Type.OBJECT,
      description: "The internal physiological experience of the subject.",
      properties: {
        impact_sensation: { type: Type.STRING, description: "The 'Nova' or immediate physical sensation (burn, freeze, whiteout)." },
        internal_collapse: { type: Type.STRING, description: "The 'Abdominal Void' or visceral reaction (nausea, organ drop, tremors, systemic shock)." }
      },
      required: ["impact_sensation", "internal_collapse"]
    },
    
    narrative_text: { type: Type.STRING, description: "The external observable reality and dialogue. 'The Inquisitor steps forward...'" },
    
    visual_prompt: { type: Type.STRING, description: "JSON describing the scene for Nano Banana (Visual Agent)." },
    choices: { type: Type.ARRAY, items: { type: Type.STRING } },
    
    ledger_update: {
      type: Type.OBJECT,
      properties: {
        physicalIntegrity: { type: Type.NUMBER, nullable: true },
        traumaLevel: { type: Type.NUMBER, nullable: true },
        shamePainAbyssLevel: { type: Type.NUMBER, nullable: true },
        hopeLevel: { type: Type.NUMBER, nullable: true },
        complianceScore: { type: Type.NUMBER, nullable: true },
        arousalLevel: { type: Type.NUMBER, nullable: true }
      },
      nullable: true
    },
    
    kgot_mutations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          operation: { type: Type.STRING, enum: ['add_edge', 'update_node', 'add_memory', 'update_grudge'] },
          params: { 
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, nullable: true },
                type: { type: Type.STRING, nullable: true },
                label: { type: Type.STRING, nullable: true },
                source: { type: Type.STRING, nullable: true },
                target: { type: Type.STRING, nullable: true },
                relation: { type: Type.STRING, nullable: true },
                weight: { type: Type.NUMBER, nullable: true },
                delta: { type: Type.NUMBER, nullable: true },
                description: { type: Type.STRING, nullable: true },
                emotional_imprint: { type: Type.STRING, nullable: true },
                involved_entities: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                manara_gaze: { type: Type.STRING, nullable: true },
                description_abyss: { type: Type.STRING, nullable: true }
            },
            nullable: true
          } 
        }
      },
      nullable: true
    },
    
    audio_cues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          mode: { type: Type.STRING, enum: ['Mocking Jester', 'Seductive Dominatrix', 'Clinical Analyst', 'Sympathetic Confidante'] },
          text_fragment: { type: Type.STRING, description: "The specific text segment to apply this voice mode to." }
        }
      },
      nullable: true
    },
    
    psychosis_text: { type: Type.STRING, nullable: true, description: "The voice of the Abyss Narrator speaking directly to the subconscious." }
  },
  required: ["thought_signature", "narrative_text", "visual_prompt", "choices", "somatic_state"]
};

// ==================== CORE LOGIC ====================

export async function executeDirectorTurn(
  playerInput: string, 
  history: string[], 
  currentGraphData: KnowledgeGraph,
  prefectDecisions: PrefectDecision[] = []
) {
  try {
    console.log("⚡ [Director] Initiating Neuro-Symbolic Turn...");

    // 1. Initialize Systems
    const controller = new KGotController(currentGraphData);
    const magellan = new MagellanController(history);
    const graphSnapshot = controller.getGraph();
    const ledger: YandereLedger = graphSnapshot.nodes['Subject_84']?.attributes?.ledger || INITIAL_LEDGER;

    // 2. Magellan Intervention Check
    const magellanDirective = magellan.getInjectionDirective(graphSnapshot);

    // 3. Narrator Selection
    const narratorMode = selectNarratorMode(ledger);
    const narratorVoice = NARRATOR_VOICES[narratorMode];

    // 4. Construct Prefect Context Block
    const prefectContext = prefectDecisions.length > 0
        ? prefectDecisions.map(d => {
            const agentName = d.prefectId.split('_').pop(); 
            return `> AGENT ${agentName} INTENT:
            - Action: "${d.actionDetail}"
            - Hidden Motive: "${d.hiddenProposal}"
            - Conflict Confidence: ${(d.confidence * 100).toFixed(0)}%
            - Constraint: You MUST integrate this action into the scene.`;
          }).join('\n')
        : "> No active Prefect interventions this turn. Focus on Environmental/Faculty pressure.";

    // 5. Dynamic Thematic Selection (State-Dependent)
    let styleConstraint = "Standard Baroque Brutalism.";
    let thematicFocus = "Weaponization of Vulnerability"; // Default Theme

    if (ledger.traumaLevel > 80) {
        styleConstraint = "CRITICAL TRAUMA STATE: Use fragmented syntax. Short, gasping sentences. Focus on sensory overload (blur, ring, whiteout). The subject is dissociating.";
        thematicFocus = "The Somatic Cascade (Nova -> Void). Describe the biological collapse.";
    } else if (ledger.complianceScore > 80) {
        styleConstraint = "HIGH COMPLIANCE STATE: Use orderly, rhythmic, almost hypnotic syntax. The subject finds peace in the structure. Describe the beauty of the Faculty.";
        thematicFocus = "Scientific Sadism. The pain is a 'calibration'.";
    } else if (ledger.arousalLevel > 60) {
        styleConstraint = "EROTICIZED DISTRESS STATE: Conflate pain keywords with desire keywords. Focus on heat, flush, and unwanted sensitivity.";
        thematicFocus = "Perverse Nurturing / Weaponized Beauty. The Hand that Strikes is the Hand you Crave.";
    } else if (ledger.hopeLevel < 20) {
        thematicFocus = "Illusion of Agency. The House Always Wins.";
    }

    // 6. Construct the Master System Prompt (v3.7 Enhanced)
    const prompt = `
    ${SYSTEM_INSTRUCTION_ROOT}

    *** THEMATIC ENGINE ACTIVATION ***
    Current Focus: ${thematicFocus}
    Constraint: Ensure the narrative reinforces '${thematicFocus}' above all else. Use the 'Grammar of Suffering'.

    *** CURRENT WORLD STATE (NEURO-SYMBOLIC MATRIX) ***
    - Player Input: "${playerInput}"
    - Turn: ${graphSnapshot.global_state.turn_count}
    - Location: ${graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || "Unknown"}
    
    *** PSYCHOMETRIC LEDGER (THE SOUL) ***
    - Trauma: ${ledger.traumaLevel}/100 (Threshold for Psychosis: 80)
    - Hope: ${ledger.hopeLevel}/100
    - Compliance: ${ledger.complianceScore}/100
    - Arousal: ${ledger.arousalLevel}/100 (Eroticized Distress)
    - Physical Integrity: ${ledger.physicalIntegrity}/100
    
    *** ACTIVE AGENT INTENTS (MANDATORY INTEGRATION) ***
    ${prefectContext}
    INSTRUCTION: The Prefects are your enforcers. You MUST enact their 'Action' and hint at their 'Hidden Motive'. 
    If a Prefect action conflicts with Player Input, resolve via 'The House Always Wins' (Player loses agency, but gains insight/trauma).

    *** MAGELLAN INJECTION ***
    ${magellanDirective || "Status: Nominal. Proceed with core loop."}

    *** ABYSS NARRATOR PROFILE ***
    Mode: ${narratorMode}
    Tone: ${narratorVoice.tone}
    Mandate: Use the "Grammar of Suffering" (Nova -> Void -> Shock -> Echo).
    
    *** DYNAMIC STYLISTIC CONSTRAINTS ***
    ${styleConstraint}
    
    *** EXECUTION INSTRUCTION (I-MCTS) ***
    1. **THEMATIC ALIGNMENT:** Review the 'Current Focus' (${thematicFocus}). 
    2. **CONFLICT RESOLUTION:** Compare Player Input vs. Prefect Intents.
       - If Player defies and Prefect punishes -> "The Subverted Gladiator" (No glory, only ruin).
       - If Player submits and Prefect comforts -> "Perverse Nurturing" (The Trap).
    3. **SOMATIC MAPPING (Grammar of Suffering):** 
       - Describe the 'Impact Sensation' (The Nova).
       - Describe the 'Internal Collapse' (The Void).
    4. **OUTPUT GENERATION:**
       - 'narrative_text': Weave the Prefect's specific action into the prose. Do not summarize; dramatize. Use precise anatomical/industrial vocabulary.
       - 'somatic_state': Precise physiological mapping.
       - 'visual_prompt': Strict adherence to the Visual Mandate.

    *** VISUAL DIRECTIVE ***
    Construct a visual_prompt JSON strictly adhering to:
    ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}
    `;

    // 7. Execution (Gemini 2.5 Flash for System 2 simulation)
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-09-2025', 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: DirectorOutputSchema,
        temperature: 1.0, 
      }
    });

    const outputText = response.text || "{}";
    const directorOutput = JSON.parse(outputText);

    // 8. Apply Mutations
    if (directorOutput.kgot_mutations) {
        const mutations = directorOutput.kgot_mutations.map((m: any) => {
            if (m.operation === 'update_node' && m.params) {
                const attributes: any = {};
                if (m.params.manara_gaze) attributes.manara_gaze = m.params.manara_gaze;
                if (m.params.description_abyss) attributes.description_abyss = m.params.description_abyss;
                return { 
                    ...m, 
                    params: { ...m.params, attributes } 
                };
            }
            return m;
        });
        controller.applyMutations(mutations);
    }
    if (directorOutput.ledger_update) {
        controller.updateLedger('Subject_84', directorOutput.ledger_update);
    }

    // Combine Somatic + Narrative for the log
    // We explicitly format the "Somatic Cascade" at the start of the log entry
    const combinedNarrative = `
    <span class="somatic-nova">${directorOutput.somatic_state?.impact_sensation || ""}</span>
    
    <span class="somatic-void">${directorOutput.somatic_state?.internal_collapse || ""}</span>
    
    ${directorOutput.narrative_text}
    `;

    // 9. Return Result
    return {
      narrative: combinedNarrative, 
      visualPrompt: directorOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: directorOutput.choices || ["Endure", "Observe"],
      thoughtProcess: `I-MCTS: ${directorOutput.thought_signature} | Mode: ${narratorMode} | Theme: ${thematicFocus}`,
      state_updates: directorOutput.ledger_update,
      audioCues: directorOutput.audio_cues,
      psychosisText: directorOutput.psychosis_text
    };

  } catch (error) {
    console.error("Director Execution Failed:", error);
    return {
      narrative: "The Loom shudders. The simulation has de-synced. (AI Error)",
      visualPrompt: "Static.",
      updatedGraph: currentGraphData,
      choices: ["Retry"],
      thoughtProcess: "Error",
      state_updates: {},
      audioCues: [],
      psychosisText: "..."
    };
  }
}
