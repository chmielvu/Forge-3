import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { KnowledgeGraph } from "./types/kgot";
import { KGotController } from "../controllers/KGotController";
import { VISUAL_MANDATE } from "../config/visualMandate";
import { selectNarratorMode, NARRATOR_VOICES } from "../services/narratorEngine";
import { PrefectDecision, YandereLedger, GameState } from "../types";
import { DIRECTOR_MASTER_PROMPT_TEMPLATE, DIRECTOR_CORE_IDENTITY } from "../config/directorCore";
import { MagellanController } from "./magellan";
import { INITIAL_LEDGER } from "../constants";
import { narrativeQualityEngine } from "../services/narrativeQualityEngine";
import { callGeminiWithRetry } from "../utils/apiRetry";

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
          operation: { type: Type.STRING, enum: ['add_edge', 'update_node', 'add_memory', 'update_grudge', 'add_trauma_bond', 'update_ledger'] },
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
                description_abyss: { type: Type.STRING, nullable: true },
                intensity: { type: Type.NUMBER, nullable: true },
                bond_type: { type: Type.STRING, nullable: true }
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

    // 5. Construct the Master System Prompt (v3.7 Enhanced)
    const prompt = DIRECTOR_MASTER_PROMPT_TEMPLATE
      .replace('{{playerInput}}', playerInput)
      .replace('{{turn}}', graphSnapshot.global_state.turn_count.toString())
      .replace('{{location}}', graphSnapshot.nodes['Subject_84']?.attributes?.currentLocation || "The Calibration Chamber")
      .replace('{{traumaLevel}}', ledger.traumaLevel.toString())
      .replace('{{complianceScore}}', ledger.complianceScore.toString())
      .replace('{{hopeLevel}}', ledger.hopeLevel.toString())
      .replace('{{shamePainAbyssLevel}}', ledger.shamePainAbyssLevel.toString())
      .replace('{{physicalIntegrity}}', ledger.physicalIntegrity.toString())
      .replace('{{prefectIntents}}', prefectContext)
      .replace('{{history}}', history.slice(-3).join('\n---\n'));

    // 6. Execution (Gemini 2.5 Flash for System 2 simulation)
    const ai = getAI();
    const response = await callGeminiWithRetry<GenerateContentResponse>(
      () => ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-09-2025', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: DirectorOutputSchema,
          temperature: 1.0, 
        }
      }),
      "Director AI"
    );

    const outputText = response.text || "{}";
    const directorOutput = JSON.parse(outputText);

    // --- HEURISTIC QUALITY ANALYSIS (Fast Layer) ---
    const qualityAnalysis = narrativeQualityEngine.analyzeNarrative(
      directorOutput.narrative_text,
      ledger
    );

    if (!qualityAnalysis.passesQuality) {
      console.warn("[Director] Narrative Heuristics Warnings:", qualityAnalysis.issues.map(i => i.message));
      // Attempt fast heuristic auto-fix (e.g. padding length, adding atmopshere)
      directorOutput.narrative_text = narrativeQualityEngine.autoFixNarrative(
        directorOutput.narrative_text,
        qualityAnalysis.issues,
        { ledger } as GameState
      );
    }

    // --- THE AESTHETE: Chain of Draft Critique (Slow Layer) ---
    console.log("🎨 [The Aesthete] Critiquing Director Output...");
    const critique = await narrativeQualityEngine.critiqueWithAesthete(
        directorOutput.narrative_text, 
        `Subject Trauma: ${ledger.traumaLevel}. Input: ${playerInput}`
    );

    if (critique.score < 80 && critique.rewrite_suggestion) {
        console.warn(`[The Aesthete] REJECTED (Score ${critique.score}). Rewriting...`);
        console.warn(`[Violations] ${critique.violations.join(', ')}`);
        
        // Apply the Rewrite
        directorOutput.narrative_text = critique.rewrite_suggestion;
        directorOutput.thought_signature += ` [AESTHETE INTERVENTION: ${critique.violations.join(', ')}]`;
    } else {
        console.log(`[The Aesthete] APPROVED (Score ${critique.score}).`);
    }
    
    // Record for history tracking
    narrativeQualityEngine.recordNarrative(directorOutput.narrative_text);
    // --------------------------------------------

    // 7. Apply Mutations
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
    const combinedNarrative = `
    <span class="somatic-nova">${directorOutput.somatic_state?.impact_sensation || ""}</span>
    
    <span class="somatic-void">${directorOutput.somatic_state?.internal_collapse || ""}</span>
    
    ${directorOutput.narrative_text}
    `;

    // 8. Return Result
    return {
      narrative: combinedNarrative, 
      visualPrompt: directorOutput.visual_prompt || "Darkness.",
      updatedGraph: controller.getGraph(),
      choices: directorOutput.choices || ["Endure", "Observe"],
      thoughtProcess: `I-MCTS: ${directorOutput.thought_signature} | Mode: ${narratorMode}`,
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
