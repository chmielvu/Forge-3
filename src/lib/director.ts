
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

// Robust API Key Retrieval
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
    thought_signature: { type: Type.STRING, description: "Deep Think: Reasoning path taken." },
    
    // STRUCTURED NARRATIVE: The Somatic Cascade
    somatic_state: {
      type: Type.OBJECT,
      description: "The internal physiological experience of the subject (The Grammar of Suffering).",
      properties: {
        impact_sensation: { type: Type.STRING, description: "The 'Nova' or immediate physical sensation (burn, freeze, whiteout)." },
        internal_collapse: { type: Type.STRING, description: "The 'Abdominal Void' or visceral reaction (nausea, organ drop, tremors, systemic shock)." }
      }
    },
    narrative_text: { type: Type.STRING, description: "The external observable reality and dialogue. 'The Inquisitor steps forward...'" },
    
    visual_prompt: { type: Type.STRING, description: "JSON describing the scene for Nano Banana." },
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
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          emotion: { type: Type.STRING }
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

    // 4. Construct the "Deep Think" Prompt
    const prompt = `
    IDENTITY: You are THE DIRECTOR of "The Forge."
    
    ${SYSTEM_INSTRUCTION_ROOT}
    ${LORE_CONSTITUTION.FACULTY_DOSSIERS.SELENE}
    ${LORE_CONSTITUTION.FACULTY_DOSSIERS.PETRA}

    *** CURRENT STATE MATRIX ***
    - Input: "${playerInput}"
    - Turn: ${graphSnapshot.global_state.turn_count}
    - Trauma: ${ledger.traumaLevel}/100
    - Hope: ${ledger.hopeLevel}/100
    - Compliance: ${ledger.complianceScore}/100
    - Arousal (Eroticized Distress): ${ledger.arousalLevel}/100
    
    *** ACTIVE AGENTS & INTENTS ***
    ${prefectDecisions.map(d => `- ${d.prefectId}: ${d.action} (${d.hiddenProposal})`).join('\n')}

    *** NARRATOR MODE: ${narratorMode} ***
    Tone: ${narratorVoice.tone}

    ${magellanDirective || ""}

    *** COGNITIVE PROTOCOL (THE SOMATIC CASCADE) ***
    Adhere strictly to the "Grammar of Suffering":
    1. **The Nova:** Immediate, blinding sensory overload (impact).
    2. **The Void:** The visceral, sickening drop in the abdomen.
    3. **The Reality:** The external world returning, cold and sharp.
    
    *** PEDAGOGICAL NECESSITY ***
    If the subject resists, do not just hurt them. Gaslight them. Frame the pain as "correction" or "calibration."
    If the subject submits, enforce "The Echo" - create a phantom sensation of pain to maintain control.

    *** INSTRUCTION ***
    1. Analyze the Player's Input. 
    2. Update the Ledger. If they show weakness + desire, spike 'arousalLevel' to model 'Eroticized Distress'.
    3. Generate the Narrative Components.
       - 'somatic_state': The internal biological collapse.
       - 'narrative_text': The external observation.
       - 'psychosis_text': If Trauma > 60, the Abyss Narrator whispers a dark truth.

    *** VISUAL DIRECTIVE ***
    Construct a visual_prompt JSON strictly adhering to:
    ${VISUAL_MANDATE.ZERO_DRIFT_HEADER}
    `;

    // 5. Execution (Gemini 2.5 Flash for speed, simulated System 2)
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

    // 6. Apply Mutations
    if (directorOutput.kgot_mutations) {
        // Map flattened schema params back to controller structure if necessary
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
    // We visually separate them in the UI, but for legacy log storage we combine or store structurally
    const combinedNarrative = `
    *${directorOutput.somatic_state?.impact_sensation || ""}*
    
    ${directorOutput.somatic_state?.internal_collapse || ""}
    
    ${directorOutput.narrative_text}
    `;

    // 7. Return Result
    return {
      narrative: combinedNarrative, 
      visualPrompt: directorOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: directorOutput.choices || ["Endure", "Observe"],
      thoughtProcess: `MAG: ${magellanDirective ? 'ACTIVE' : 'IDLE'} | SIG: ${directorOutput.thought_signature}`,
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
