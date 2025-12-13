import { GoogleGenAI } from "@google/genai";
import { PrefectDNA, FilteredSceneContext, PrefectThought, PrefectArchetype, TraitVector } from '../../types';

type ConversationHistory = { role: 'user' | 'model'; content: string }[];

// Helper to inject behavioral instructions based on archetype
function getArchetypeBehavior(archetype: PrefectArchetype, traits: TraitVector): string {
  // ... [Keep existing implementation logic, just updating the class]
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

const buildPrefectPrompt = (prefect: PrefectDNA, scene: FilteredSceneContext): string => `
You are ${prefect.displayName}, a Prefect at The Forge competing for one of TWO Teaching Assistant positions.

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

=== THE COMPETITION (ZERO-SUM) ===
Your current Favor Score: ${scene.yourFavorScore}/100
Competitors:
${scene.otherPrefects.map(p => `- ${p.name}: ${p.favorScore} (Recent: ${p.recentActions})`).join('\n')}

=== CURRENT SCENE ===
Location: ${scene.location}
Scene: ${scene.description}
Faculty Mood: ${scene.facultyMood}
Faculty Present: ${scene.facultyPresent.join(', ')}
Subject 84 Trauma: ${scene.playerTrauma}/1.0

=== STRATEGIC MANDATES ===
1. How can you INCREASE your favor while DECREASING a competitor's?
2. Who is vulnerable to sabotage?
3. What does the Faculty want to see RIGHT NOW?

=== BEHAVIOR ===
${getArchetypeBehavior(prefect.archetype, prefect.traitVector)}

=== RESPONSE FORMAT (JSON) ===
{
  "publicAction": "What you do/say openly",
  "hiddenMotivation": "Your TRUE reason",
  "internalMonologue": "Private thoughts",
  "sabotageAttempt": { "target": "Name", "method": "...", "deniability": 0.0-1.0 } | null,
  "allianceSignal": { "target": "Name", "message": "..." } | null,
  "emotionalState": { "paranoia": 0-1, "desperation": 0-1, "confidence": 0-1 },
  "secretsUncovered": ["string"],
  "favorScoreDelta": number (-10 to 10 estimate)
}
`;

export class PrefectAgent {
  private client: GoogleGenAI;
  public dna: PrefectDNA;
  private history: ConversationHistory;
  
  constructor(dna: PrefectDNA) {
    this.dna = dna;
    // Vite-compliant API Key access
    this.client = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });
    this.history = [];
  }

  async think(scene: FilteredSceneContext): Promise<PrefectThought> {
    const prompt = buildPrefectPrompt(this.dna, scene);
    
    try {
      const result = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-lite-latest', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.95, // High variance for competition
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              publicAction: { type: 'STRING' },
              hiddenMotivation: { type: 'STRING' },
              internalMonologue: { type: 'STRING' },
              sabotageAttempt: {
                type: 'OBJECT',
                properties: {
                  target: { type: 'STRING' },
                  method: { type: 'STRING' },
                  deniability: { type: 'NUMBER' }
                },
                nullable: true
              },
              allianceSignal: {
                type: 'OBJECT',
                properties: {
                  target: { type: 'STRING' },
                  message: { type: 'STRING' }
                },
                nullable: true
              },
              emotionalState: {
                type: 'OBJECT',
                properties: {
                  paranoia: { type: 'NUMBER' },
                  desperation: { type: 'NUMBER' },
                  confidence: { type: 'NUMBER' }
                }
              },
              secretsUncovered: { type: 'ARRAY', items: { type: 'STRING' } },
              favorScoreDelta: { type: 'NUMBER' }
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

      return thought;

    } catch (error) {
      console.error(`[PrefectAgent] Error for ${this.dna.displayName}:`, error);
      return this.generateFallbackThought();
    }
  }

  private generateFallbackThought(): PrefectThought {
    return {
      agentId: this.dna.id,
      publicAction: `${this.dna.displayName} watches silently, calculating options.`,
      hiddenMotivation: "System Error - Fallback Mode",
      internalMonologue: "...",
      sabotageAttempt: null,
      allianceSignal: null,
      emotionalState: { paranoia: 0.5, desperation: 0.5, confidence: 0.5 },
      secretsUncovered: [],
      favorScoreDelta: 0
    };
  }
}