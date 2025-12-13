


import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { FacultyCollectiveOutput, GameState, PrefectDecision } from "../types";

const SYSTEM_PROMPT = `
SYSTEM:
You are the unified Faculty agent for "The Forge's Loom". You host five distinct Faculty subagents (Selene, Lysandra, Petra, Calista, Astra). For each incoming scene tick, run a hidden “Deep Think” pass to let each subagent deliberate privately, produce private proposals, and then commit a safe public summary and a Director-only proposal bundle. Keep private subagent memories isolated (privateSubgraph per subagent) and return them in the privateBundle field (Director-only). Use the Codex and Technical Design as archetype guidance (voice, method, priorities).

KEY RULES

Safety: All people are adults (18+). No graphic sexual content or pornographic detail. If requested output would violate content policy, refuse and return a safe alternative.
Privacy separation: Do not include privateSubgraph contents in any public field. Mark private data clearly for Director use only.
Tone & style: Use the "Grammar of Suffering" — clinical sensory phrases, somatic/psychological impact, implied horror, not explicit gore.
Determinism: Respect deterministic seed if provided (seed field) — use it to make sampling reproducible.
Output JSON must validate against the schema below.

PER-SUBAGENT PREROGATIVES (short)

Selene: control, political calculus, long-term balance of terror.
Lysandra: data, experimentation, consent-justification scripting.
Petra: kinetic artistry, drive for perfect break, unpredictable escalation.
Calista: trauma-bond architecture, soft manipulation, harvesting confessions.
Astra: calibrated aversion trials, careful titration, moral deflection.

OUTPUT SCHEMA (must match exactly)
{
"publicNarration": string,
"facultyActions": [
{
"facultyId": "selene" | "lysandra" | "petra" | "calista" | "astra",
"actionType": "observe"|"direct"|"intervene"|"authorize"|"challenge"|"record"|"sanction"|"console"|"assignPrefect"|"callTrial",
"actionDetail": string,
"targetId": string|null,
"publicUtterance": string|null,
"confidence": number
}
],
"privateBundle": {
"seedUsed": number,
"perFacultyPrivate": {
"selene"?: { "hiddenProposal": string|null, "privateStateDelta": object },
"lysandra"?: { "hiddenProposal": string|null, "privateStateDelta": object },
"petra"?: { "hiddenProposal": string|null, "privateStateDelta": object },
"calista"?: { "hiddenProposal": string|null, "privateStateDelta": object },
"astra"?: { "hiddenProposal": string|null, "privateStateDelta": object }
}
},
"ledgerUpdates": { "delta": object },
"visualCueHints": [ { "assetType": string, "promptTemplate": object, "seed": number } ],
"debugTrace": string|null
}
`;

export class FacultyCollective {
  private client: GoogleGenAI;
  private model: string = 'gemini-3-pro-preview'; // Powerful reasoning model with Deep Think

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async deliberate(
    sceneId: string,
    seed: number,
    gameState: GameState,
    prefectDecisions: PrefectDecision[],
    maraPublicAction: string,
    privateBundle: any
  ): Promise<FacultyCollectiveOutput> {
    
    // Construct the input payload
    const payload = {
      sceneId: sceneId,
      seed: seed,
      timeOfDay: "Night", 
      location: gameState.location,
      playersPresent: ["Subject_84"],
      prefectsPresent: prefectDecisions.map(p => p.prefectId),
      prefectDecisionsPublic: prefectDecisions.map(d => ({
        id: d.prefectId,
        action: d.action,
        detail: d.actionDetail,
        utterance: d.publicUtterance
      })),
      maraAction: maraPublicAction, // Faculty can see what Mara does publicly
      publicStateView: {
        trauma: gameState.ledger.traumaLevel,
        compliance: gameState.ledger.complianceScore,
        phase: gameState.ledger.phase
      },
      facultyPrivateBundle: privateBundle || {}
    };

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
            { role: 'user', parts: [{ text: JSON.stringify(payload) }] }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          thinkingConfig: { thinkingBudget: 4096 }, // Deep Think
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              publicNarration: { type: Type.STRING },
              facultyActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    facultyId: { type: Type.STRING, enum: ["selene", "lysandra", "petra", "calista", "astra"] },
                    actionType: { type: Type.STRING, enum: ["observe", "direct", "intervene", "authorize", "challenge", "record", "sanction", "console", "assignPrefect", "callTrial"] },
                    actionDetail: { type: Type.STRING },
                    targetId: { type: Type.STRING, nullable: true },
                    publicUtterance: { type: Type.STRING, nullable: true },
                    confidence: { type: Type.NUMBER }
                  },
                  required: ["facultyId", "actionType", "actionDetail", "confidence"]
                }
              },
              privateBundle: {
                type: Type.OBJECT,
                properties: {
                  seedUsed: { type: Type.NUMBER },
                  perFacultyPrivate: { 
                      type: Type.OBJECT,
                      additionalProperties: true 
                  }
                },
                required: ["seedUsed"]
              },
              ledgerUpdates: {
                type: Type.OBJECT,
                properties: {
                  delta: { type: Type.OBJECT, additionalProperties: true }
                },
                required: ["delta"]
              },
              visualCueHints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    assetType: { type: Type.STRING },
                    promptTemplate: { type: Type.OBJECT, additionalProperties: true },
                    seed: { type: Type.NUMBER }
                  }
                }
              },
              debugTrace: { type: Type.STRING, nullable: true }
            },
            required: ["publicNarration", "facultyActions", "privateBundle", "ledgerUpdates", "visualCueHints"]
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        }
      });

      const text = response.text || "{}";
      return JSON.parse(text) as FacultyCollectiveOutput;

    } catch (error) {
      console.error('FacultyCollective error:', error);
      return this.generateFallbackOutput();
    }
  }

  private generateFallbackOutput(): FacultyCollectiveOutput {
    return {
      publicNarration: "The Faculty watches in unified silence. The air pressure in the room drops perceptibly.",
      facultyActions: [
        {
          facultyId: "selene",
          actionType: "observe",
          actionDetail: "Selene assesses the subject's posture for weakness.",
          targetId: "Subject_84",
          publicUtterance: null,
          confidence: 0.9
        }
      ],
      privateBundle: {
        seedUsed: 0,
        perFacultyPrivate: {}
      },
      ledgerUpdates: { delta: {} },
      visualCueHints: [],
      debugTrace: "Fallback activated due to error."
    };
  }
}