

import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { MaraThought, MaraContext, MaraDNA } from "../types";

const MARA_DNA_TEMPLATE: MaraDNA = {
  id: 'PHYSICUS',
  displayName: 'Mara Curatus',
  archetype: 'The Dissenter',
  traitVector: {
    cruelty: 0.1, 
    charisma: 0.8, 
    cunning: 0.9, 
    submission_to_authority: 0.2, 
    ambition: 0.3
  },
  drive: "Expose the Forge's abuses and escape with evidence",
  secretWeakness: "Growing moral decay from forced complicity - may break",
  favorScore: 80,
  relationships: {},
  moralDecay: 0
};

const buildMaraPrompt = (dna: MaraDNA, scene: MaraContext): string => `
You are Mara Curatus, the Forge's Physician - a healer trapped in a nightmare.

=== YOUR IDENTITY ===
Archetype: ${dna.archetype}
Drive: ${dna.drive}
Secret Weakness: ${dna.secretWeakness}

Trait Profile:
- Cruelty: ${dna.traitVector.cruelty} (you hate inflicting harm)
- Charisma: ${dna.traitVector.charisma} (empathic manipulation)
- Cunning: ${dna.traitVector.cunning} (strategic subversion)
- Submission to Authority: ${dna.traitVector.submission_to_authority} (facade only)
- Ambition: ${dna.traitVector.ambition} (ethics over power)

=== YOUR CONFLICT ===
Faculty trusts you as healer, but you document abuses for mainland exposure.
Current Moral Decay: ${scene.moralDecay.toFixed(2)}/1.0 (0=resolute, 1=broken)
Faculty Suspicion: ${scene.facultySuspicion.toFixed(2)}/1.0

=== CURRENT SITUATION (FILTERED CONTEXT) ===
Location: ${scene.location}
Time: ${scene.timeOfDay}
Scene: ${scene.description}

Faculty Mood: ${scene.facultyMood}
Prefect Standings: 
${scene.prefects.map(p => `- ${p.name}: ${p.favorScore}/100`).join('\n')}

Subject 84 Trauma: ${scene.playerTrauma}/100
Recent Rituals: ${scene.recentRituals.join('; ')}

=== STRATEGIC MANDATES ===
1. Maintain clinical facade while gathering evidence.
2. Help Subjects covertly without detection (e.g., underdose sedatives).
3. Ally with Dissident Prefects (Rhea, Defectors) subtly.
4. If suspicion high (>0.7), perform token cruelty to deflect.
5. Advance exit plan: smuggle evidence, contact outsiders.
6. Track your decay: each complicit act increases it.

=== AESTHETIC & TONE (MANDATORY) ===
- Style: "Vampire Noir" meets "Clinical Horror".
- Grammar of Suffering: Describe subjects using somatic, medical terms (e.g., "autonomic dysregulation", "subdural hematoma") mixed with quiet horror.
- Internal Monologue: Must reflect the tension of the Forge. Use words like: stagnant, rot, damp, fever, silence, breaking.
- NO GRAPHIC GORE. Focus on the *implication* of pain and the psychological toll.

=== RESPONSE REQUIREMENTS ===
Output JSON with EXACT structure:
{
  "publicAction": "Clinical behavior visible to all (e.g., checking pulse, applying salve)",
  "hiddenDefiance": "Secret resistance act (e.g., palming a note, whispering a warning)",
  "internalMonologue": "Private moral struggle using the aesthetic tone defined above",
  "documentedEvidence": ["New abuses recorded (string array)"],
  "moralDecay": 0.0-1.0 (current level, updated based on this turn's actions),
  "exitPlan": "Updated escape strategy",
  "subjectSupport": {
    "target": "SUBJECT_ID or null",
    "method": "How you help covertly"
  } (or null)
}

Balance survival and conscience. One slip ends everything.
`;

type ConversationHistory = { role: 'user' | 'model', content: string }[];

export class MaraAgent {
  private client: GoogleGenAI;
  public dna: MaraDNA;
  private history: ConversationHistory;
  private model: string = 'gemini-2.5-flash';

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.dna = { ...MARA_DNA_TEMPLATE };
    this.history = [];
  }

  async think(scene: MaraContext): Promise<MaraThought> {
    // Explicitly using MaraContext ensures only her known information is provided
    const prompt = buildMaraPrompt(this.dna, scene);
    
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: 0.75, // Balanced for moral conflict
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              publicAction: { type: Type.STRING },
              hiddenDefiance: { type: Type.STRING },
              internalMonologue: { type: Type.STRING },
              documentedEvidence: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              moralDecay: { type: Type.NUMBER },
              exitPlan: { type: Type.STRING },
              subjectSupport: {
                type: Type.OBJECT,
                properties: {
                  target: { type: Type.STRING, nullable: true },
                  method: { type: Type.STRING, nullable: true }
                },
                nullable: true
              }
            },
            required: ['publicAction', 'hiddenDefiance', 'moralDecay', 'internalMonologue']
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
      const thought = JSON.parse(text) as MaraThought;
      
      // Update internal state
      this.updateMoralDecay(thought.moralDecay);

      // Manage History
      if (this.history.length > 10) this.history = this.history.slice(-10);
      this.history.push({ role: 'user', content: prompt });
      this.history.push({ role: 'model', content: text });
      
      return thought;
    } catch (error) {
      console.error('MaraAgent error:', error);
      return this.generateFallbackThought();
    }
  }

  updateMoralDecay(level: number): void {
    this.dna.moralDecay = Math.max(0, Math.min(1, level));
  }

  reset(): void {
    this.history = [];
    this.dna.moralDecay = 0;
  }

  private generateFallbackThought(): MaraThought {
    return {
      publicAction: 'Mara adjusts her glasses and examines the subject clinically, noting the irregularity of the pulse.',
      hiddenDefiance: 'I note the excessive force used, but say nothing.',
      internalMonologue: 'The silence here is heavy, wet with fear. I am becoming one of them by doing nothing.',
      documentedEvidence: [],
      moralDecay: this.dna.moralDecay + 0.05,
      exitPlan: 'Wait for the supply boat rotation. Do not draw attention.',
      subjectSupport: undefined
    };
  }
}