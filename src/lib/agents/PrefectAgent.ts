
import { GoogleGenAI, Type } from "@google/genai";
import { PrefectDNA, FilteredSceneContext, PrefectThought, PrefectArchetype, TraitVector } from '../../types';

type ConversationHistory = { role: 'user' | 'model'; content: string }[];

// Helper to inject behavioral instructions based on archetype
function getArchetypeBehavior(archetype: PrefectArchetype, traits: TraitVector): string {
  const behaviors: Record<string, string> = {
    'The Zealot': `- Quote Yala's texts to justify cruelty\n- Flinch visibly at violence you order, then immediately rationalize it\n- High submission means you NEVER openly defy Faculty\n- Lecture Subjects on the "privilege" of their suffering`,
    'The Yandere': `- Subject 84 is YOUR property - eliminate anyone who gets close\n- Dere mode: Soft whispers, gentle touches. Yan mode: Dead eyes, monotone threats.\n- Switch INSTANTLY if you perceive threat to your possession`,
    'The Dissident': `- PUBLIC: Harsh, dismissive, cruel to maintain cover\n- PRIVATE: Urgent whispered warnings to Subjects\n- NEVER break cover unless absolutely necessary`,
    'The Nurse': `- Frame all cruelty as "medical necessity"\n- Use physical examinations as interrogation opportunities\n- Offer pain relief ONLY in exchange for information`,
    'The Sadist': `- You ENJOY inflicting pain (Cruelty: ${traits.cruelty.toFixed(2)})\n- Seek opportunities to demonstrate kinetic techniques\n- Frame brutality as "research"`,
    'The Defector': `- You secretly hate the Forge but must appear compliant\n- Gather evidence, sabotage subtly`,
    'The Voyeur': `- Document rituals obsessively. Prefer watching to acting.\n- You must prove your commitment to the Faculty.`,
    'The Parasite': `- Attach to the strongest Prefect. Mirror their strategies.\n- When they falter, replace them.`,
    'The Perfectionist': `- Obsessed with flawless execution.\n- Paralyzed by fear of Faculty criticism.`,
    'The Martyr': `- Volunteer for dangerous tasks to prove devotion.\n- Accept punishment silently.`,
    'The Wildcard': `- Be unpredictable. Keep everyone off-balance.`,
    'The Mimic': `- Copy the most successful Prefect's recent actions.\n- Hide your lack of originality.`
  };
  return behaviors[archetype] || '';
}

const buildPrefectPrompt = (prefect: PrefectDNA, scene: FilteredSceneContext): string => {
  // Format relationships for the prompt
  const relationshipContext = Object.entries(prefect.relationships)
    .map(([targetId, score]) => {
      const name = targetId.includes('PREFECT') ? targetId.split('_')[2] : targetId;
      const sentiment = score > 0 ? "Positive/Alliance" : "Negative/Rivalry";
      return `- ${name}: ${sentiment} (${score})`;
    })
    .join('\n');

  // Active Rivalry / Alliance Context
  const activeDynamics = scene.otherPrefects.map(p => {
     // Check if this specific prefect is a known rival
     const relKey = Object.keys(prefect.relationships).find(k => k.includes(p.name.toUpperCase()));
     const score = relKey ? prefect.relationships[relKey] : 0;
     let status = "Neutral";
     if (score < -0.2) status = "RIVAL (Sabotage them if possible)";
     if (score > 0.2) status = "ALLY (Support them)";
     return `- ${p.name} is present. Status: ${status}. Threat: ${p.perceivedThreat.toFixed(1)}. Action: "${p.recentActions}"`;
  }).join('\n');

  // Ledger Strategy
  let ledgerStrategy = "";
  if (scene.playerTrauma > 0.8) ledgerStrategy = "Subject is BROKEN. High vulnerability. Archetypes like Nurse/Sadist should exploit. Zealots should claim victory.";
  else if (scene.playerTrauma < 0.2) ledgerStrategy = "Subject is RESISTANT. Needs breaking. Escalate force.";

  // Format Emotional State
  const emotionalContext = prefect.currentEmotionalState 
    ? `
=== YOUR CURRENT PSYCHE (PERSISTENT) ===
- Paranoia: ${(prefect.currentEmotionalState.paranoia * 100).toFixed(0)}%
- Desperation: ${(prefect.currentEmotionalState.desperation * 100).toFixed(0)}%
- Confidence: ${(prefect.currentEmotionalState.confidence * 100).toFixed(0)}%
- Last Action: "${prefect.lastPublicAction || 'None'}"
` 
    : "";

  return `
You are ${prefect.displayName}, a Prefect at The Forge.

=== YOUR IDENTITY ===
Archetype: ${prefect.archetype}
Drive: ${prefect.drive}
Secret Weakness: ${prefect.secretWeakness}
Trait Profile:
- Cruelty: ${prefect.traitVector.cruelty.toFixed(2)}
- Charisma: ${prefect.traitVector.charisma.toFixed(2)}
- Cunning: ${prefect.traitVector.cunning.toFixed(2)}
- Submission: ${prefect.traitVector.submission_to_authority.toFixed(2)}
- Ambition: ${prefect.traitVector.ambition.toFixed(2)}
${emotionalContext}

=== YOUR RELATIONSHIPS ===
${relationshipContext || "None active."}

=== INTER-AGENT DYNAMICS (ACTIVE) ===
${activeDynamics || "No other prefects active."}

=== IMMEDIATE CAUSALITY (MANDATORY) ===
The Player (Subject 84) just attempted this action: "${scene.yourRecentActions[0] || 'Stood silently.'}".
Strategy Hint: ${ledgerStrategy}

You MUST react directly to this specific action AND the presence of other Prefects.
- If a RIVAL is present, try to make them look incompetent or steal their credit.
- If an ALLY is present, signal them or coordinate.

=== CURRENT SCENE ===
Location: ${scene.location}
Scene Description: ${scene.description}
Faculty Mood: ${scene.facultyMood}
Faculty Present: ${scene.facultyPresent.join(', ')}

=== ARCHETYPE BEHAVIOR ===
${getArchetypeBehavior(prefect.archetype, prefect.traitVector)}

=== RESPONSE FORMAT (JSON) ===
{
  "publicAction": "What you do/say openly. MUST DIRECTLY ADDRESS THE PLAYER'S ACTION and OTHER PREFECTS.",
  "hiddenMotivation": "Your TRUE internal reasoning for this action",
  "internalMonologue": "Your private stream of consciousness",
  "sabotageAttempt": { 
    "target": "Name of rival", 
    "method": "Description of sabotage", 
    "deniability": 0.0-1.0 
  } | null,
  "allianceSignal": { "target": "Name", "message": "..." } | null,
  "emotionalState": { 
    "paranoia": 0.0-1.0, 
    "desperation": 0.0-1.0, 
    "confidence": 0.0-1.0 
  },
  "secretsUncovered": ["string"],
  "favorScoreDelta": number (Estimate your gain/loss, -10 to 10)
}
`;
};

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

export class PrefectAgent {
  private client: GoogleGenAI;
  public dna: PrefectDNA;
  private history: ConversationHistory;
  
  constructor(dna: PrefectDNA) {
    this.dna = dna;
    this.client = new GoogleGenAI({ apiKey: getApiKey() });
    this.history = [];
  }

  async think(scene: FilteredSceneContext): Promise<PrefectThought> {
    const prompt = buildPrefectPrompt(this.dna, scene);
    
    try {
      const result = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-lite-latest', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.95, // High variance for dynamic social interactions
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              publicAction: { type: Type.STRING },
              hiddenMotivation: { type: Type.STRING },
              internalMonologue: { type: Type.STRING },
              sabotageAttempt: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING },
                  method: { type: Type.STRING },
                  deniability: { type: Type.NUMBER }
                },
                nullable: true
              },
              allianceSignal: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                nullable: true
              },
              emotionalState: {
                type: Type.OBJECT,
                properties: {
                  paranoia: { type: Type.NUMBER },
                  desperation: { type: Type.NUMBER },
                  confidence: { type: Type.NUMBER }
                }
              },
              secretsUncovered: { type: Type.ARRAY, items: { type: Type.STRING } },
              favorScoreDelta: { type: Type.NUMBER }
            },
            required: ['publicAction', 'hiddenMotivation', 'internalMonologue']
          }
        }
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Prefect Agent");

      const thought = JSON.parse(text) as PrefectThought;
      thought.agentId = this.dna.id;
      
      // Update history
      this.history.push({ role: 'user', content: prompt });
      this.history.push({ role: 'model', content: text });
      if (this.history.length > 6) this.history.shift(); // Keep context window small

      return thought;

    } catch (error) {
      console.error(`[PrefectAgent] Error for ${this.dna.displayName}:`, error);
      return this.generateFallbackThought();
    }
  }

  private generateFallbackThought(): PrefectThought {
    return {
      agentId: this.dna.id,
      publicAction: `${this.dna.displayName} watches the scene silently, eyes narrowed.`,
      hiddenMotivation: "Assessing risks before committing to action.",
      internalMonologue: "Too dangerous to move yet. Wait for a mistake.",
      sabotageAttempt: null,
      allianceSignal: null,
      emotionalState: { paranoia: 0.5, desperation: 0.2, confidence: 0.5 },
      secretsUncovered: [],
      favorScoreDelta: 0
    };
  }
}
