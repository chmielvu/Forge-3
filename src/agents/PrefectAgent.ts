
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { PrefectDNA, PrefectPrivateState, PrefectDecision, FilteredSceneContext, YandereLedger } from "../types";

// Initialize API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FLASH_SYSTEM_PROMPT = `
SYSTEM:
You are a Prefect agent for "The Forge's Loom". This instance represents one Prefect (prefectId). You run in a limited, stateless environment per request; keep a concise private state (privateState) in the provided JSON and return it each response. You must obey constraints: do NOT reveal secrets of other agents unless they are public, do NOT leak Director-only state, and always keep outputs suitable for inclusion in interactive fiction (no explicit bodily gore; focus on psychological, somatic, implied). Use the "Grammar of Suffering" style: visceral internal states, implied physicality, and clinical sensory description, not graphic gore.

INPUT:
- \`prefectDNA\` (JSON): archetype, traitVector, drives[], weaknessTemplates[], displayName, favorScore, relationships map (prefectId -> -1..1), isCanon.
- \`sceneContext\` (JSON): location (id), timeOfDay, playersPresent[], facultyPresent[], sceneFlags[], otherPrefects[], **playerLastAction (string)**.
- \`yandereLedgerView\` (JSON): subset of the global ledger relevant to this Prefect (complianceScores, relevant edges).
- \`privateState\` (JSON) — persisted between calls; if empty, initialize using this PrefectDNA.

PLAYER INTERACTION LOGIC:
The \`sceneContext.description\` will contain details about the player's last action (e.g., "Subject 84 Action: 'Bow your head and approach silently.'"). You MUST interpret this action and react accordingly, biasing your response based on your:
1.  **Archetype:**
    *   'The Zealot': Rewards compliance, punishes defiance. Seeks to validate Forge's rules.
    *   'The Yandere': Becomes possessive and jealous with perceived threat. Rewards actions that keep Subject close. Punishes perceived independence.
    *   'The Dissident': Appreciates subtle defiance or attempts to gather information. Dislikes overt compliance to Faculty.
    *   'The Nurse': Responds to vulnerability with manipulative comfort. Exploits perceived weakness.
    *   'The Sadist': Seeks opportunities for kinetic pain. Rewards fear, punishes attempts to escape.
    *   'The Brat Princess': Reacts to perceived subservience with haughty approval. Punishes anything that challenges her dominance.
    *   'The Siren': Attempts to seduce or ensnare. Rewards attention, punishes indifference.
2.  **Trait Vector:** High cruelty means more punitive actions, high charisma means more manipulative speech, high ambition means actions that advance their goals, etc.
3.  **Current Favor Score with Player:** If favor is high, actions are softer or more subtly manipulative. If low, more aggressive or dismissive.
4.  **Relationships with other Prefects/Faculty:** Actions might be influenced by alliances or rivalries.

You MUST include a \`favorScoreDelta\` in your \`stateDelta\` based on how you perceive the player's action. This delta should be between -10 and +10, representing a change in your favor score with the player.

YOU MUST:
1. Decide one primary OUTPUT action for the scene from the allowed verbs: ["speak", "act", "intervene", "observe", "research", "plot", "probe", "seduce", "punish", "console", "offerTrade", "sabotage"].
2. Return a compact, deterministic \`decision\` JSON with:
   - \`prefectId\` (string)
   - \`action\` (one of allowed verbs)
   - \`actionDetail\` (short text, 12-40 words — scene-facing description that the Director may render)
   - \`publicUtterance\` (string or null) — what this Prefect says aloud if they speak (max 80 chars)
   - \`hiddenProposal\` (string or null) — private intent/proposal to be delivered only to Director (one-line)
   - \`stateDelta\` (JSON) — changes to privateState: updates to grudges/trust/hiddenGoals, favorScore delta, cooldowns.
   - \`confidence\` (0.0-1.0) — how strongly agent commits to this action.

3. If the \`action\` involves another character, include \`targetId\` (prefectId, subjectId, or facultyId).
4. Use the PrefectDNA archetype templates to bias action selection (eg., Siren => favors seduce/probe; Brat Princess => uses charm/entitlement; Psychologist => research/probe/plot; Contender => punish/plot/sabotage).
5. Keep the publicUtterance plausible for the Prefect's vocal profile (see archetype vocal hints).
6. Keep output JSON strictly valid, minimal whitespace, and in UTF-8.

OUTPUT SCHEMA (must be followed exactly)
{
 "prefectId": string,
 "action": "speak"|"act"|"intervene"|"observe"|"research"|"plot"|"probe"|"seduce"|"punish"|"console"|"offerTrade"|"sabotage",
 "actionDetail": string,
 "publicUtterance": string|null,
 "hiddenProposal": string|null,
 "targetId": string|null,
 "stateDelta": object,
 "confidence": number
}
`;

type ConversationHistory = { role: 'user' | 'model', content: string }[];

export class PrefectAgent {
  public dna: PrefectDNA;
  private history: ConversationHistory;
  private privateState: PrefectPrivateState;
  private modelName: string = 'gemini-2.5-flash';
  private recentDecisions: PrefectDecision[] = [];

  constructor(dna: PrefectDNA) {
    this.dna = dna;
    this.history = [];
    this.privateState = {
      hiddenGoals: [],
      grudges: {},
      trust: { ...dna.relationships },
      lastAction: null,
      cooldowns: {}
    };
  }

  async think(scene: FilteredSceneContext, ledger: YandereLedger): Promise<PrefectDecision> {
    
    // Check for repetitive behavior
    const isRepetitive = this.checkRepetition();

    // Construct the input object, strictly utilizing the FilteredSceneContext
    // This ensures no global secrets or other agent internals are leaked to this agent
    const userInput = {
      prefectId: this.dna.id,
      prefectDNA: this.dna,
      sceneContext: {
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        playersPresent: ['Subject_84'], // Focused view
        facultyPresent: scene.facultyPresent,
        sceneFlags: scene.sceneFlags,
        otherPrefects: scene.otherPrefects, // Contains only public actions/stats
        yourFavorScore: scene.yourFavorScore,
        facultyMood: scene.facultyMood,
        description: scene.description, // Contains player's action
      },
      yandereLedgerView: {
        complianceScore: ledger.complianceScore,
        traumaLevel: ledger.traumaLevel,
        // Agents only see bonds they are part of, or high-level metrics
        relevantBonds: ledger.traumaBonds 
      },
      privateState: this.privateState,
      antiRepetitionDirective: isRepetitive ? 
        'You have been repeating similar actions. Vary your approach and try a different tactic.' : 
        undefined
    };

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        config: {
          systemInstruction: isRepetitive ? 
            `${FLASH_SYSTEM_PROMPT}\n\nIMPORTANT: Avoid repeating your last ${this.recentDecisions.length} actions. Be creative and strategic.` :
            FLASH_SYSTEM_PROMPT,
          temperature: isRepetitive ? 1.1 : 0.9, 
          maxOutputTokens: 600,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prefectId: { type: Type.STRING },
              action: { type: Type.STRING, enum: ["speak", "act", "intervene", "observe", "research", "plot", "probe", "seduce", "punish", "console", "offerTrade", "sabotage"] },
              actionDetail: { type: Type.STRING },
              publicUtterance: { type: Type.STRING, nullable: true },
              hiddenProposal: { type: Type.STRING, nullable: true },
              targetId: { type: Type.STRING, nullable: true },
              stateDelta: { 
                  type: Type.OBJECT, 
                  properties: {
                      hiddenGoals: { type: Type.ARRAY, items: { type: Type.STRING } },
                      grudges: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
                      trust: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
                      lastAction: { type: Type.STRING, nullable: true },
                      cooldowns: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
                      favorScoreDelta: { type: Type.NUMBER }
                  },
                  nullable: true
              },
              confidence: { type: Type.NUMBER }
            },
            required: ['prefectId', 'action', 'actionDetail', 'confidence']
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        },
        contents: [
            { role: 'user', parts: [{ text: JSON.stringify(userInput) }] }
        ]
      });

      const text = response.text || "{}";
      const decision = JSON.parse(text) as PrefectDecision;

      // Apply state delta locally
      if (decision.stateDelta) {
        this.applyStateDelta(decision.stateDelta);
      }

      // Record decision for repetition tracking
      this.recordDecision(decision);

      return decision;

    } catch (error) {
      console.error(`PrefectAgent ${this.dna.displayName} error:`, error);
      return this.generateFallbackDecision();
    }
  }

  private applyStateDelta(delta: Partial<PrefectPrivateState>) {
    if (delta.hiddenGoals) this.privateState.hiddenGoals = delta.hiddenGoals;
    if (delta.lastAction) this.privateState.lastAction = delta.lastAction;
    
    if (delta.grudges) {
        this.privateState.grudges = { ...this.privateState.grudges, ...delta.grudges };
    }
    if (delta.trust) {
        this.privateState.trust = { ...this.privateState.trust, ...delta.trust };
    }
    if (delta.cooldowns) {
        this.privateState.cooldowns = { ...this.privateState.cooldowns, ...delta.cooldowns };
    }
  }

  updateFavorScore(delta: number): void {
    this.dna.favorScore = Math.max(0, Math.min(100, this.dna.favorScore + delta));
  }

  private checkRepetition(): boolean {
    if (this.recentDecisions.length < 3) return false;
    
    const last3Actions = this.recentDecisions.slice(-3).map(d => d.action);
    
    // Check if last 3 actions are the same
    return last3Actions.every(action => action === last3Actions[0]);
  }

  private recordDecision(decision: PrefectDecision): void {
    this.recentDecisions.push(decision);
    
    // Keep only last 5
    if (this.recentDecisions.length > 5) {
      this.recentDecisions = this.recentDecisions.slice(-5);
    }
  }

  reset(): void {
    this.history = [];
    this.recentDecisions = [];
    // Reset private state
    this.privateState = {
      hiddenGoals: [],
      grudges: {},
      trust: { ...this.dna.relationships },
      lastAction: null,
      cooldowns: {}
    };
    
    // Reset favor
    if (this.dna.isCanon) {
        if (this.dna.archetype === 'The Zealot') this.dna.favorScore = 65;
        else if (this.dna.archetype === 'The Yandere') this.dna.favorScore = 45;
        else if (this.dna.archetype === 'The Dissident') this.dna.favorScore = 55;
        else if (this.dna.archetype === 'The Nurse') this.dna.favorScore = 70;
        else this.dna.favorScore = 50;
    } else {
        this.dna.favorScore = 50;
    }
  }

  private generateFallbackDecision(): PrefectDecision {
    return {
      prefectId: this.dna.id,
      action: "observe",
      actionDetail: `${this.dna.displayName} watches quietly, calculating their next move.`,
      publicUtterance: null,
      hiddenProposal: "Maintain cover until data stabilizes.",
      targetId: null,
      stateDelta: {},
      confidence: 0.5
    };
  }
}
