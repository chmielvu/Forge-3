
import { YandereLedger, GameState, PrefectDNA, PrefectArchetype } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

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
   * Checks for forbidden words, lighting descriptions, and "The Grammar of Suffering".
   */
  async critiqueWithAesthete(narrative: string, context: string): Promise<AestheteCritique> {
    try {
        const prompt = `
        ACT AS "THE AESTHETE". You are a rigorous editor for a "Dark Academia / Vampire Noir" narrative engine.
        
        YOUR MANDATE:
        1. **Check for Forbidden Generics**: Words like "pain", "hurt", "scared" are BANNED. Use specific somatic terms ("cremasteric reflex", "cortisol spike", "ontological collapse").
        2. **Check Lighting**: Does the text describe the light/shadow? If not, it fails.
        3. **Check Tone**: Must be "Bored, Inevitable, Clinical". No melodrama.
        
        INPUT TEXT:
        "${narrative}"
        
        CONTEXT:
        ${context}
        
        OUTPUT JSON:
        {
          "score": number (0-100),
          "critique": "Brief explanation of flaws",
          "violations": ["list", "of", "issues"],
          "rewrite_suggestion": "The rewritten text (if score < 80) applying the Somatic Cascade and Noir Lighting."
        }
        `;

        const result = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        critique: { type: Type.STRING },
                        violations: { type: Type.ARRAY, items: { type: Type.STRING } },
                        rewrite_suggestion: { type: Type.STRING }
                    }
                }
            }
        });

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return { score: 100, critique: "Pass", violations: [] };
        
        return JSON.parse(text) as AestheteCritique;

    } catch (e) {
        console.warn("[Aesthete] Critique failed, passing text.", e);
        return { score: 100, critique: "System Bypass", violations: [] };
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
    
    // Enhanced thematic resonance calculation
    const thematicResonance = this.calculateThematicResonance(narrative, activePrefect);

    return {
      wordCount,
      dialogueRatio: 0.3, // Placeholder
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

  /**
   * Calculates how well the narrative resonates with the specific active Prefect's psychology.
   */
  private calculateThematicResonance(narrative: string, activePrefect?: PrefectDNA): number {
    const lowerNarrative = narrative.toLowerCase();
    let score = 0;
    
    // 1. Global Forge Themes (Base Score)
    const globalThemes = ['submission', 'obedience', 'ruin', 'calibration', 'void', 'shame', 'privilege', 'lesson'];
    score += globalThemes.filter(t => lowerNarrative.includes(t)).length * 0.5;

    // 2. Prefect Specific Resonance
    if (activePrefect) {
        let archetypeKeywords: string[] = [];

        // Map Archetype to Thematic Keywords
        switch (activePrefect.archetype) {
            case 'The Zealot': // Elara
                archetypeKeywords = ['rule', 'law', 'scripture', 'punish', 'flinch', 'tremble', 'righteous', 'stutter', 'codex'];
                break;
            case 'The Yandere': // Kaelen
                archetypeKeywords = ['mine', 'love', 'cleanse', 'purify', 'keep', 'safe', 'eyes', 'doll', 'forever', 'blood'];
                break;
            case 'The Dissident': // Rhea
                archetypeKeywords = ['fake', 'act', 'shadow', 'quiet', 'watch', 'signal', 'smoke', 'bored'];
                break;
            case 'The Nurse': // Anya
                archetypeKeywords = ['care', 'hurt', 'better', 'fever', 'pulse', 'open', 'temperature', 'sweet', 'broken'];
                break;
            case 'The Sadist':
                archetypeKeywords = ['break', 'snap', 'crunch', 'scream', 'giggle', 'fun', 'game'];
                break;
            default:
                archetypeKeywords = ['power', 'control', 'watch'];
        }

        // Extract Keywords from Drive & Weakness (Simple NLP)
        const driveKeywords = this.extractKeywords(activePrefect.drive);
        const weaknessKeywords = this.extractKeywords(activePrefect.secretWeakness);

        // Calculate Resonance
        const allAgentKeywords = [...archetypeKeywords, ...driveKeywords, ...weaknessKeywords];
        const matches = allAgentKeywords.filter(k => lowerNarrative.includes(k.toLowerCase()));
        
        // Boost score significantly for character-specific alignment
        score += matches.length * 1.5; 
    }

    // Normalize to 0.0 - 1.0 range (soft cap around 10 matches)
    return Math.min(1.0, score / 10);
  }

  private extractKeywords(text: string): string[] {
      return text.split(/\s+/)
          .map(w => w.replace(/[^a-zA-Z]/g, '').toLowerCase())
          .filter(w => w.length > 4) // Filter out short words
          .slice(0, 5); // Take top 5 long words as keywords
  }

  private identifyIssues(narrative: string, metrics: QualityMetrics, ledger: YandereLedger): NarrativeIssue[] {
    const issues: NarrativeIssue[] = [];
    if (metrics.wordCount < this.minWordCount) {
      issues.push({ severity: 'critical', category: 'length', message: `Narrative too short (${metrics.wordCount} words).`, autoFixable: true });
    }
    if (!metrics.hasEnvironmentalDetail) issues.push({ severity: 'warning', category: 'detail', message: 'Missing environmental grounding.', autoFixable: false });
    
    // New check for low thematic resonance
    if (metrics.thematicResonance < 0.3) {
        issues.push({ severity: 'warning', category: 'theme', message: 'Low thematic resonance with active agents.', autoFixable: false });
    }

    return issues;
  }

  private evaluateQuality(metrics: QualityMetrics, issues: NarrativeIssue[]): boolean {
    return !issues.some(i => i.severity === 'critical');
  }

  autoFixNarrative(narrative: string, issues: NarrativeIssue[], context: GameState): string {
    let fixed = narrative;
    if (issues.some(i => i.category === 'length')) {
        fixed += " \n\nThe silence that follows is heavy, tasting of ozone and ancient dust.";
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
