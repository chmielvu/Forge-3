
import { YandereLedger, PrefectDNA, PrefectArchetype, GameState } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { useGameStore } from '../state/gameStore';
import { localGrunt } from './localMediaService';
import { THEME } from '../theme'; // Updated from @/theme

// API Key retrieval for internal use (Legacy fallback)
const getApiKey = (): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.API_KEY) return import.meta.env.API_KEY;
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
  somatic_check: string; 
  thematic_check: string; 
}

export class NarrativeQualityEngine {
  private minWordCount = 300;
  private previousNarratives: string[] = [];
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: getApiKey() });
  }
  
  /**
   * API-Free "Aesthete" Critique using Transformers.js via Local Worker
   * Replaces Gemini API call for speed and reliability.
   */
  async critiqueLocal(narrative: string): Promise<AestheteCritique> {
    const violations: string[] = [];
    let score = 100;

    // 1. Regex Heuristics (The "Banned Words" List)
    const banned = [/felt sad/i, /felt scared/i, /shivered in fear/i, /felt pain/i];
    
    if (banned.some(regex => regex.test(narrative))) {
      score -= 15;
      violations.push("Vocabulary: Use somatic details (e.g. 'spasm', 'void') instead of generic emotional telling.");
    }

    // 2. Lighting/Atmosphere Check
    if (!/light|shadow|dark|neon|fluores|dim|gleam|glare/i.test(narrative)) {
      score -= 10;
      violations.push("Atmosphere: Missing Chiaroscuro elements.");
    }

    // 3. Local Inference: Tone Check via localGrunt (Qwen 0.5B in Worker)
    try {
      const isToneCorrect = await localGrunt.checkTone(narrative);
      if (!isToneCorrect) {
        score -= 25;
        violations.push("Tone Mismatch: Narrative detected as 'LIGHT' (Wholesome/Melodramatic). Require 'DARK' (Clinical/Cynical).");
      }
    } catch (e) {
      console.warn("Local worker tone check failed, skipping.", e);
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      critique: violations.length > 0 ? violations.join(" ") : "Aesthetic Standards Met.",
      violations,
      somatic_check: "Local Check (Hybrid)",
      thematic_check: "Local Check (Hybrid)"
    };
  }

  /**
   * THE AESTHETE: Hybrid Critique
   * Prefers local check for speed/cost, falls back to API only if explicitly requested or critical.
   */
  async critiqueWithAesthete(narrative: string, context: string): Promise<AestheteCritique> {
    const isLite = useGameStore.getState().isLiteMode;

    // Use Local Aesthete by default for performance
    if (isLite || Math.random() > 0.1) { // 90% Local Check
        return await this.critiqueLocal(narrative);
    }

    // Remote Fallback (Gemini 2.5 Flash-lite) - Kept for critical deep dives if needed
    try {
        const prompt = `
        ACT AS "THE AESTHETE". Strict Editor Mode.
        RULES: No generic suffering words. Must describe lighting. Tone must be clinical/bored.
        
        NARRATIVE: "${narrative.substring(0, 1000)}..."
        
        Evaluate. If Score < 85, provide rewrite.
        OUTPUT JSON ONLY.
        `;

        const result = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        critique: { type: Type.STRING },
                        violations: { type: Type.ARRAY, items: { type: Type.STRING } },
                        somatic_check: { type: Type.STRING },
                        thematic_check: { type: Type.STRING },
                        rewrite_suggestion: { type: Type.STRING }
                    }
                }
            }
        });

        const text = result.text;
        if (!text) return await this.critiqueLocal(narrative);
        return JSON.parse(text) as AestheteCritique;

    } catch (e) {
        console.warn("[Aesthete] Remote critique failed, falling back to local.", e);
        return await this.critiqueLocal(narrative);
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

  /**
   * Reparis malformed JSON strings.
   * Uses simple heuristics first, then attempts a local LLM repair if available.
   */
  async repairMalformedJson(jsonString: string): Promise<string> {
      // 1. Basic cleanup
      let cleaned = jsonString
          .replace(/```json|```/g, '') // Remove markdown
          .trim();
      
      // 2. Try parse immediately after cleanup
      try {
          JSON.parse(cleaned);
          return cleaned; 
      } catch (e) {
          // Continue to advanced repair
      }

      // 3. Attempt robust repair via localGrunt (Llama 3.2 1B)
      console.warn("[NarrativeQualityEngine] Basic JSON parsing failed. Engaging Llama repair protocol...");
      try {
          const repaired = await localGrunt.repairJson(cleaned);
          // Validate the result
          JSON.parse(repaired); 
          return repaired;
      } catch (repairError) {
          console.error("[NarrativeQualityEngine] Critical: JSON Repair failed.", repairError);
          throw new Error("JSON_REPAIR_FAILED");
      }
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
    return Math.min(1.0, score / 10);
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
            ];
            let addedContent = '';
            let remainingWords = wordsToAdd;
            let fillerIndex = 0;
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
        } else {
            environmentalAdd = `The air within ${location} carries a faint metallic tang, a signature of the unseen machinery.`;
        }
        fixed = `${fixed}\n\n${environmentalAdd}`;
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
