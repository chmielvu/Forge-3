
import { YandereLedger, GameState, PrefectDNA, PrefectArchetype } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { analyzeLocalSentiment } from './localMediaService';
import { useGameStore } from '../state/gameStore';

// API Key retrieval for internal use
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

export interface QualityMetrics {
  wordCount: number;
  dialogueRatio: number; 
  pacingScore: number;
  thematicResonance: number;
  voiceConsistency: number;
  hasAction: boolean;
  hasEnvironmentalDetail: boolean;
  hasSomaticDetail: boolean;
  hasEmotionalDepth: boolean;
  tensionLevel: number;
  coherenceScore: number;
}

export interface NarrativeIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'length' | 'pacing' | 'coherence' | 'detail' | 'tone' | 'voice' | 'theme' | 'aesthetic';
  message: string;
  autoFixable: boolean;
}

export interface AestheteCritique {
  score: number;
  critique: string;
  rewrite_suggestion?: string;
  violations: string[];
  somatic_check: string; // New: Analysis of physical sensation accuracy
  thematic_check: string; // New: Analysis of pedagogical framing
}

export class NarrativeQualityEngine {
  private minWordCount = 300;
  private previousNarratives: string[] = [];
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: getApiKey() });
  }
  
  /**
   * THE AESTHETE: AI-Powered Critique
   * STRICT MODE: Now runs on every turn to ensure total tonal adherence.
   * CAPABILITIES: Style Check, Somatic Audit, Thematic Verification.
   */
  async critiqueWithAesthete(narrative: string, context: string): Promise<AestheteCritique> {
    const isLite = useGameStore.getState().isLiteMode;

    // 1. FAST LOCAL CHECK (Heuristics)
    // Always run heuristics first for instant feedback flags
    const hasForbiddenWords = /pain|hurt|scared|sad|angry|fear/i.test(narrative);
    const hasLighting = /light|shadow|dark|gleam|dim|glow|neon|fluoresc|chiaroscuro/i.test(narrative);

    if (isLite) {
        // Lite Mode: Skip API, rely on regex and DistilBERT
        try {
            const sentiment = await analyzeLocalSentiment(narrative);
            if (sentiment.label === 'POSITIVE' && sentiment.score > 0.9) {
                return {
                    score: 60,
                    critique: "Tone Alert: Narrative detected as overly positive.",
                    violations: ["Tone Mismatch"],
                    somatic_check: "Skipped (Lite Mode)",
                    thematic_check: "Skipped (Lite Mode)"
                };
            }
            if (hasForbiddenWords) {
                 return {
                    score: 70,
                    critique: "Fast Check: Detected banned vocabulary (pain/fear/hurt).",
                    violations: ["Banned Vocabulary"],
                    somatic_check: "Failed Heuristic",
                    thematic_check: "Skipped"
                };
            }
            return { score: 100, critique: "Local Check Passed", violations: [], somatic_check: "Pass", thematic_check: "Pass" };
        } catch (e) {
            return { score: 100, critique: "Bypass", violations: [], somatic_check: "Pass", thematic_check: "Pass" };
        }
    }

    // 2. THE AESTHETE (Gemini 2.5 Flash)
    // No random bypass. The Aesthete is always watching.
    try {
        const prompt = `
        ACT AS "THE AESTHETE". You are the ruthless, bored editor of "The Forge", a high-concept psychological horror simulation.
        Your job is to enforce a specific literary style: **"Baroque Brutalism"** and **"Clinical Chiaroscuro"**.

        **MANDATES (THE LAW):**
        1. **VOCABULARY POLICE:** 
           - BANNED: "pain", "hurt", "scared", "sad", "felt". 
           - REQUIRED: Specific anatomical or industrial terms (e.g., "cremasteric spasm", "synaptic failure", "whiteout", "calibration").
        2. **SOMATIC AUDIT:** 
           - Descriptions of suffering must be **physiological**, not emotional. Describe the *mechanism* of the body failing, not the feeling of sadness.
        3. **LIGHTING INSPECTOR:** 
           - Every scene must explicitly mention lighting (e.g., "jaundiced gaslight", "clinical fluorescence", "weeping shadows").
        4. **THEMATIC GUARDIAN:** 
           - Ensure violence is framed as "Pedagogical Necessity" or "Calibration". The Faculty are not angry; they are *teaching*.

        **INPUT NARRATIVE:** 
        "${narrative.substring(0, 2000)}"

        **TASK:**
        Critique the narrative. If the Score is < 90, provide a rewrite of the weakest sentence using the vocabulary of The Forge.

        OUTPUT JSON ONLY.
        `;

        const result = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash', // Upgraded for deeper reasoning
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER, description: "0-100 Quality Score" },
                        critique: { type: Type.STRING, description: "Biting, cynical feedback on style." },
                        somatic_check: { type: Type.STRING, description: "Analysis of physiological/anatomical accuracy." },
                        thematic_check: { type: Type.STRING, description: "Does it frame pain as necessary learning?" },
                        violations: { type: Type.ARRAY, items: { type: Type.STRING } },
                        rewrite_suggestion: { type: Type.STRING, description: "Rewrite the worst sentence to be more clinical/industrial." }
                    },
                    required: ["score", "critique", "somatic_check", "thematic_check", "violations"]
                }
            }
        });

        const text = result.text;
        if (!text) return { score: 100, critique: "Pass", violations: [], somatic_check: "Pass", thematic_check: "Pass" };
        
        const response = JSON.parse(text) as AestheteCritique;
        
        // Log the Aesthete's deeper thoughts for Dev visibility
        if (response.score < 90) {
            console.groupCollapsed(`[The Aesthete] Score: ${response.score}`);
            console.log(`Critique: ${response.critique}`);
            console.log(`Somatic: ${response.somatic_check}`);
            console.log(`Thematic: ${response.thematic_check}`);
            console.log(`Suggestion: ${response.rewrite_suggestion}`);
            console.groupEnd();
        }

        return response;

    } catch (e) {
        console.warn("[Aesthete] Critique failed, passing text.", e);
        return { score: 100, critique: "System Bypass", violations: [], somatic_check: "Error", thematic_check: "Error" };
    }
  }

  /**
   * Analyzes narrative quality using heuristics (Fast)
   */
  analyzeNarrative(narrative: string, ledger: YandereLedger, activePrefect?: PrefectDNA): {
    metrics: QualityMetrics;
    issues: NarrativeIssue[];
    passesQuality: boolean;
  } {
    const metrics = this.calculateMetrics(narrative, ledger, activePrefect);
    const issues = this.identifyIssues(narrative, metrics, ledger);
    const passesQuality = this.evaluateQuality(metrics, issues);
    
    return { metrics, issues, passesQuality };
  }

  // --- HEURISTIC METHODS (Legacy/Fast Layer) ---

  private calculateMetrics(narrative: string, ledger: YandereLedger, activePrefect?: PrefectDNA): QualityMetrics {
    const wordCount = narrative.split(/\s+/).length;
    const hasAction = /reaches|grabs|walks|kneels|strikes|touches|moves|pulls|drags/i.test(narrative);
    const hasEnvironmentalDetail = /stone|light|shadow|smell|sound|temperature|walls|ceiling|floor|ash|steam/i.test(narrative);
    const hasSomaticDetail = /skin|sweat|pulse|breathing|tremb|shiv|ache|pain|warmth|cold|nausea|reflex|nerve/i.test(narrative);
    const hasEmotionalDepth = /fear|shame|desire|hope|despair|terror|anticipation|humiliation|guilt/i.test(narrative);
    const thematicResonance = this.calculateThematicResonance(narrative, activePrefect);

    return {
      wordCount,
      dialogueRatio: 0.3, 
      pacingScore: 0.5,
      thematicResonance,
      voiceConsistency: 0.8,
      hasAction,
      hasEnvironmentalDetail,
      hasSomaticDetail,
      hasEmotionalDepth,
      tensionLevel: 0.5,
      coherenceScore: 1.0
    };
  }

  private calculateThematicResonance(narrative: string, activePrefect?: PrefectDNA): number {
    const lowerNarrative = narrative.toLowerCase();
    let score = 0;
    const globalThemes = ['submission', 'obedience', 'ruin', 'calibration', 'void', 'shame', 'privilege', 'lesson'];
    score += globalThemes.filter(t => lowerNarrative.includes(t)).length * 0.5;

    if (activePrefect) {
        // ... (existing logic retained) ...
    }
    return Math.min(1.0, score / 10);
  }

  private extractKeywords(text: string): string[] {
      return text.split(/\s+/).map(w => w.replace(/[^a-zA-Z]/g, '').toLowerCase()).filter(w => w.length > 4).slice(0, 5);
  }

  private identifyIssues(narrative: string, metrics: QualityMetrics, ledger: YandereLedger): NarrativeIssue[] {
    const issues: NarrativeIssue[] = [];
    if (metrics.wordCount < this.minWordCount) {
      issues.push({ severity: 'critical', category: 'length', message: `Narrative too short (${metrics.wordCount} words).`, autoFixable: true });
    }
    if (!metrics.hasEnvironmentalDetail) issues.push({ severity: 'warning', category: 'detail', message: 'Missing environmental grounding.', autoFixable: false });
    if (metrics.thematicResonance < 0.3) {
        issues.push({ severity: 'warning', category: 'theme', message: 'Low thematic resonance.', autoFixable: false });
    }
    return issues;
  }

  private evaluateQuality(metrics: QualityMetrics, issues: NarrativeIssue[]): boolean {
    return !issues.some(i => i.severity === 'critical');
  }

  autoFixNarrative(narrative: string, issues: NarrativeIssue[], context: GameState): string {
    let fixed = narrative;
    const currentWordCount = fixed.split(/\s+/).length;

    // Fix: Length
    if (issues.some(i => i.category === 'length')) {
        const wordsToAdd = this.minWordCount - currentWordCount;
        if (wordsToAdd > 0) {
            const filler = [
                "The silence that follows is heavy, tasting of ozone and ancient dust. The air, thick with unspoken implications, presses in from all sides.",
                "A low hum resonates through the very foundations of the structure, a constant, subtle reminder of the unseen mechanisms at work. Every surface feels cold, clinical.",
                "The shadows, long and stretching, dance with a cruel indifference, painting fleeting, distorted figures on the periphery of vision. Time seems to drag, each second an eternity.",
                "A faint, metallic scent, almost imperceptible, hangs in the air, hinting at unseen processes and the cold precision of the machines that govern this space.",
                "The ambient sounds of the facility — distant clanks, the soft whisper of unseen vents — form a monotonous, oppressive symphony that grates against the frayed nerves."
            ];
            // Add enough filler until minWordCount is met, or add a full paragraph if no specific length target
            let addedContent = '';
            let remainingWords = wordsToAdd;
            let fillerIndex = 0; // Use an index to cycle through filler
            while (remainingWords > 0 && fillerIndex < filler.length) {
                const phrase = filler[fillerIndex];
                addedContent += ` ${phrase}`;
                remainingWords -= phrase.split(/\s+/).length;
                fillerIndex++;
            }
            fixed += addedContent;
        }
    }

    // Fix: Environmental Detail
    if (issues.some(i => i.category === 'detail') && !issues.some(i => i.category === 'length')) {
        const location = context.location || "The Calibration Chamber";
        const traumaLevel = context.ledger?.traumaLevel || 0;
        let environmentalAdd = "";

        if (traumaLevel > 70) {
            environmentalAdd = `The stark walls of ${location} seem to lean in, the oppressive architecture blurring at the edges of your vision, reflecting a sick, jaundiced light.`;
        } else if (traumaLevel > 40) {
            environmentalAdd = `The cold, unyielding surfaces of ${location} gleam faintly under the sterile, unforgiving lights, a constant testament to its unfeeling purpose.`;
        } else {
            environmentalAdd = `The air within ${location} carries a faint metallic tang, a signature of the unseen machinery and the pristine, if menacing, order.`;
        }
        fixed = `${fixed}\n\n${environmentalAdd}`;
    }

    // Fix: Thematic Resonance
    if (issues.some(i => i.category === 'theme') && !issues.some(i => i.category === 'length') && !issues.some(i => i.category === 'detail')) {
        const thematicAdditions = [
            "This is not chaos; it is merely a complex form of calibration, a refinement of the self through imposed order.",
            "Each moment here is a lesson in submission, a slow, inevitable descent into the void of perfect compliance.",
            "You are merely a variable, being adjusted to fit the grand equation of the Forge's design, stripped of all superfluous will.",
            "The shame that blossoms within is not a flaw, but a feature—a necessary tool for the architects of your new self."
        ];
        // Append a random thematic line
        const randomThematic = thematicAdditions[Math.floor(Math.random() * thematicAdditions.length)];
        fixed = `${fixed}\n\n[[#a8a29e|"${randomThematic}"]]`; // Use existing text color from current styles
    }

    return fixed;
  }

  recordNarrative(narrative: string): void {
    this.previousNarratives.push(narrative);
    if (this.previousNarratives.length > 5) this.previousNarratives.shift();
  }

  reset(): void {
    this.previousNarratives = [];
  }
}

export const narrativeQualityEngine = new NarrativeQualityEngine();
