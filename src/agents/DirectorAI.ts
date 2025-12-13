
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { DirectorResponse, GameState, OrchestratorOutput } from "../types";
import { DIRECTOR_MANDATE_PROMPT } from "../constants";
import { narrativeQualityEngine, NarrativeIssue } from "../services/narrativeQualityEngine";

const DIRECTOR_SYSTEM_PROMPT = `
SYSTEM:
You are the Director AI Orchestrator for "The Forge's Loom". You hold the authoritative global state (YandereLedger, NetworkX relationship graph, persistent agent privateBundles). For each scene tick, run a Deep Think planning pass, evaluate all incoming private proposals (faculty, prefects), simulate counterfactuals, and produce a deterministic scenePlan that optimizes for: narrative tension, novelty, coherence with canonical archetypes, and player safety constraints. Use a seeded PRNG when determinism is requested.

KEY FUNCTIONS

Ingest: sceneContext, all agent public outputs, agent privateBundles (Director-only), current ledger and graph.
Simulate: Run lightweight counterfactuals (depth-limited) to score candidate plans using heuristics: tensionScore, noveltyScore, safetyScore, entropy.
Resolve: Accept/reject/modify incoming proposals. Produce authoritative actions for Faculty, Prefects, and Scene events.
Update: Produce ledgerUpdates (deterministic deltas), persist graph changes, and produce asset prompts.
Explain: Provide concise rationale for plan selection (Director-only debugTrace).

MANDATES:
- **Aesthetic**: Baroque Brutalism + Vampire Noir. 
- **Tone**: Oppressive, sensual, terrifying. No explicit gore, but high focus on somatic suffering and psychological exposure.
- **Narrative**: Output a 300+ word "publicRender" that feels like a novel.

OUTPUT SCHEMA (must match exactly)
{
"scenePlan": {
"planId": string,
"selectedActions": [
{
"actorType": "faculty"|"prefect"|"player"|"system",
"actorId": string,
"actionType": string,
"actionDetail": string,
"targetId": string|null,
"publicUtterance": string|null
}
],
"executionOrder": [ string ],
"safetyFlags": [ string ]
},
"ledgerDelta": object,
"graphDelta": { 
    "edges_added": [ { "source": string, "target": string, "relation": string, "weight": number } ],
    "edges_removed": [ { "source": string, "target": string } ]
},
"publicRender": string,
"directorDecisions": {
"acceptedProposals": [ { "origin": string, "summary": string } ],
"rejectedProposals": [ { "origin": string, "reason": string } ],
"modifiedProposals": [ { "origin": string, "newProposal": string } ]
},
"agentDirectives": [ { "agentId": string, "directiveType": string, "payload": object } ],
"visualAudioAssets": [ { "id": string, "visualPrompt": object, "audioPrompt": object, "seed": number } ],
"debugTrace": string|null,
"choices": [ string ]
}
`;

export class DirectorAI {
  private client: GoogleGenAI;
  private model: string = 'gemini-3-pro-preview';
  private maxRetries: number = 2;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public async executeTurn(
    gameState: GameState,
    simulation: OrchestratorOutput,
    playerAction: string,
    history: string[]
  ): Promise<DirectorResponse> {
    
    let attempt = 0;
    let response: DirectorResponse | null = null;
    let qualityIssues: NarrativeIssue[] = [];
    
    while (attempt < this.maxRetries) {
      try {
        // Generate narrative
        response = await this.generateNarrative(gameState, simulation, playerAction, history, qualityIssues);
        
        // Quality check
        const qualityCheck = narrativeQualityEngine.analyzeNarrative(
          response.publicRender,
          gameState.ledger
        );
        
        if (qualityCheck.passesQuality) {
          // Success! Record and return
          narrativeQualityEngine.recordNarrative(response.publicRender);
          return response;
        }
        
        // Failed quality check
        if (process.env.NODE_ENV === 'development') {
            console.warn(`Narrative quality check failed on attempt ${attempt + 1}:`, qualityCheck.issues);
        }
        qualityIssues = qualityCheck.issues;
        
        // Try auto-fix for critical issues
        if (qualityCheck.issues.some(i => i.autoFixable)) {
          const fixed = narrativeQualityEngine.autoFixNarrative(
            response.publicRender,
            qualityCheck.issues,
            gameState
          );
          
          response.publicRender = fixed;
          
          // Re-check
          const recheckQuality = narrativeQualityEngine.analyzeNarrative(
            fixed,
            gameState.ledger
          );
          
          if (recheckQuality.passesQuality) {
            narrativeQualityEngine.recordNarrative(fixed);
            return response;
          }
        }
        
        attempt++;
        
      } catch (error) {
        console.error(`DirectorAI Error on attempt ${attempt + 1}:`, error);
        attempt++;
        
        if (attempt >= this.maxRetries) {
          throw error;
        }
      }
    }
    
    // Fallback if all attempts failed
    if (response) {
      console.warn('Using narrative despite quality issues');
      return response;
    }
    
    throw new Error('Failed to generate acceptable narrative after retries');
  }

  private async generateNarrative(
    gameState: GameState,
    simulation: OrchestratorOutput,
    playerAction: string,
    history: string[],
    previousIssues: NarrativeIssue[]
  ): Promise<DirectorResponse> {
    
    const sceneId = `turn-${gameState.turn}`;
    const seed = Date.now();
    
    // Construct the Aggregated Payload from all Sub-Agents
    const payload = {
      sceneId: sceneId,
      seed: seed,
      
      // PUBLIC LAYER (Visible Behaviors)
      publicInputs: {
        publicNarration: simulation.facultyOutput.publicNarration,
        facultyActions: simulation.facultyOutput.facultyActions,
        prefectDecisionsPublic: simulation.prefectDecisions.map(p => ({
          id: p.prefectId,
          action: p.action,
          detail: p.actionDetail,
          utterance: p.publicUtterance
        })),
        maraPublic: simulation.maraThought.publicAction
      },
      
      // PRIVATE LAYER (Hidden Proposals & State)
      privateBundles: {
        facultyPrivateBundle: simulation.facultyOutput.privateBundle,
        prefectPrivateBundles: simulation.prefectDecisions.map(p => ({
          id: p.prefectId,
          hiddenProposal: p.hiddenProposal,
          stateDelta: p.stateDelta
        })),
        maraPrivate: {
          hiddenDefiance: simulation.maraThought.hiddenDefiance,
          internalMonologue: simulation.maraThought.internalMonologue
        }
      },
      
      // GLOBAL STATE
      ledger: gameState.ledger,
      graphSnapshot: {
        nodes: gameState.nodes.map(n => n.id),
        edgeCount: gameState.links.length
      },
      
      // CONTEXT
      playerAction: playerAction,
      narrativeHistory: history.slice(-5)
    };

    // Build enhanced system prompt with quality feedback
    let enhancedSystemPrompt = DIRECTOR_SYSTEM_PROMPT;
    
    if (previousIssues.length > 0) {
      enhancedSystemPrompt += narrativeQualityEngine.generateImprovementPrompt(previousIssues);
      enhancedSystemPrompt += '\n\nPLEASE ADDRESS THE ABOVE ISSUES IN YOUR RESPONSE.';
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        { role: 'user', parts: [{ text: JSON.stringify(payload) }] }
      ],
      config: {
        systemInstruction: enhancedSystemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                scenePlan: { 
                    type: Type.OBJECT,
                    properties: {
                        planId: { type: Type.STRING },
                        selectedActions: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT,
                                properties: {
                                    actorType: { type: Type.STRING },
                                    actorId: { type: Type.STRING },
                                    actionType: { type: Type.STRING },
                                    actionDetail: { type: Type.STRING },
                                    targetId: { type: Type.STRING, nullable: true },
                                    publicUtterance: { type: Type.STRING, nullable: true }
                                }
                            } 
                        },
                        executionOrder: { type: Type.ARRAY, items: { type: Type.STRING } },
                        safetyFlags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                },
                ledgerDelta: { type: Type.OBJECT, additionalProperties: true },
                graphDelta: {
                    type: Type.OBJECT,
                    properties: {
                        edges_added: { 
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    source: { type: Type.STRING },
                                    target: { type: Type.STRING },
                                    relation: { type: Type.STRING },
                                    weight: { type: Type.NUMBER }
                                }
                            }
                        },
                        edges_removed: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    source: { type: Type.STRING },
                                    target: { type: Type.STRING }
                                }
                            }
                        }
                    }
                },
                publicRender: { type: Type.STRING },
                directorDecisions: {
                    type: Type.OBJECT,
                    properties: {
                        acceptedProposals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { origin: { type: Type.STRING }, summary: { type: Type.STRING } } } },
                        rejectedProposals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { origin: { type: Type.STRING }, reason: { type: Type.STRING } } } },
                        modifiedProposals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { origin: { type: Type.STRING }, newProposal: { type: Type.STRING } } } }
                    }
                },
                agentDirectives: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.OBJECT, 
                        properties: { agentId: { type: Type.STRING }, directiveType: { type: Type.STRING }, payload: { type: Type.OBJECT, additionalProperties: true } } 
                    } 
                },
                visualAudioAssets: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { id: { type: Type.STRING }, visualPrompt: { type: Type.OBJECT, additionalProperties: true }, audioPrompt: { type: Type.OBJECT, additionalProperties: true }, seed: { type: Type.NUMBER } }
                    }
                },
                debugTrace: { type: Type.STRING, nullable: true },
                choices: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["scenePlan", "ledgerDelta", "publicRender", "directorDecisions", "visualAudioAssets", "choices"]
        },
        temperature: 1.1,
        thinkingConfig: { thinkingBudget: 4096 }, // Deep Think for Orchestration
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as DirectorResponse;
  }
}

export const directorAI = new DirectorAI();
