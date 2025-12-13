
import { YandereLedger, GameState, PrefectDNA } from '../types';

export interface QualityMetrics {
  wordCount: number;
  dialogueRatio: number; // 0-1
  pacingScore: number; // 0-1 (variation in sentence length)
  thematicResonance: number; // 0-1
  voiceConsistency: number; // 0-1
  hasAction: boolean;
  hasEnvironmentalDetail: boolean;
  hasSomaticDetail: boolean;
  hasEmotionalDepth: boolean;
  tensionLevel: number;
  coherenceScore: number;
}

export interface NarrativeIssue {
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'length' | 'pacing' | 'coherence' | 'detail' | 'tone' | 'voice' | 'theme';
  message: string;
  autoFixable: boolean;
}

const VOICE_SIGNATURES: Record<string, { keywords: string[], forbidden: string[], style: string }> = {
  'Selene': { 
    keywords: ['inevitable', 'boring', 'tedious', 'architect', 'entropy', 'child', 'wine'], 
    forbidden: ['oops', 'sorry', 'maybe', 'scared'], 
    style: 'regal_boredom' 
  },
  'Petra': { 
    keywords: ['snap', 'break', 'fun', 'joke', 'toy', 'pop', 'giggle'], 
    forbidden: ['data', 'hypothesis', 'gentle', 'theory'], 
    style: 'manic_predatory' 
  },
  'Lysandra': { 
    keywords: ['data', 'variable', 'response', 'fascinating', 'cortex', 'synapse'], 
    forbidden: ['hate', 'love', 'evil', 'good', 'soul'], 
    style: 'clinical_detached' 
  },
  'Calista': { 
    keywords: ['sweetling', 'pet', 'hush', 'love', 'safe', 'mother'], 
    forbidden: ['maggot', 'trash', 'die'], 
    style: 'corrupted_nurture' 
  }
};

const THEMATIC_KEYWORDS = {
  somatic: ['pulse', 'throb', 'sweat', 'tremble', 'ache', 'nerve', 'bile'],
  industrial: ['forge', 'hammer', 'grind', 'steam', 'iron', 'rust', 'gear'],
  religious: ['sacred', 'ritual', 'confess', 'sin', 'altar', 'god', 'prayer'],
  academic: ['study', 'lesson', 'grade', 'fail', 'thesis', 'curriculum']
};

const ARCHETYPE_THEMES: Record<string, string[]> = {
  'The Yandere': ['possession', 'purification', 'cleanse', 'mine', 'forever', 'doll', 'keep', 'safe', 'love', 'jealous'],
  'The Zealot': ['rule', 'order', 'law', 'necessity', 'transgression', 'punish', 'correct', 'yala', 'scripture', 'flinch'],
  'The Dissident': ['burn', 'lie', 'fake', 'signal', 'secret', 'act', 'stage', 'mask', 'shadow', 'freedom'],
  'The Nurse': ['cure', 'heal', 'fix', 'broken', 'study', 'anatomy', 'incision', 'sedate', 'exam', 'medicine'],
  'The Sadist': ['break', 'snap', 'scream', 'limit', 'flesh', 'tear', 'beg', 'cry', 'kinetic', 'sport'],
  'The Defector': ['escape', 'report', 'evidence', 'hidden', 'run', 'outside', 'mainland'],
  'The Voyeur': ['watch', 'record', 'see', 'archive', 'note', 'observe', 'witness'],
  'The Parasite': ['leech', 'copy', 'mimic', 'take', 'feed', 'attach', 'host'],
  'The Perfectionist': ['flawless', 'perfect', 'exact', 'measure', 'align', 'mistake', 'error'],
  'The Martyr': ['suffer', 'sacrifice', 'bleed', 'give', 'endure', 'holy', 'altar'],
  'The Wildcard': ['chaos', 'random', 'chance', 'luck', 'spin', 'twist', 'game'],
  'The Mimic': ['mirror', 'reflect', 'same', 'duplicate', 'echo', 'image']
};

export class NarrativeQualityEngine {
  private minWordCount = 300;
  private maxWordCount = 600;
  private previousNarratives: string[] = [];
  
  /**
   * Analyzes narrative quality and identifies issues
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

  private calculateMetrics(narrative: string, ledger: YandereLedger, activePrefect?: PrefectDNA): QualityMetrics {
    const wordCount = narrative.split(/\s+/).length;
    
    // Core Elements
    const hasAction = /reaches|grabs|walks|kneels|strikes|touches|moves|pulls|drags/i.test(narrative);
    const hasEnvironmentalDetail = /stone|light|shadow|smell|sound|temperature|walls|ceiling|floor|ash|steam/i.test(narrative);
    const hasSomaticDetail = /skin|sweat|pulse|breathing|tremb|shiv|ache|pain|warmth|cold|nausea/i.test(narrative);
    const hasEmotionalDepth = /fear|shame|desire|hope|despair|terror|anticipation|humiliation|guilt/i.test(narrative);
    
    // Advanced Metrics
    const dialogueRatio = this.calculateDialogueRatio(narrative);
    const pacingScore = this.calculatePacingScore(narrative);
    const thematicResonance = this.calculateThematicResonance(narrative, activePrefect);
    const voiceConsistency = this.calculateVoiceConsistency(narrative);
    const tensionLevel = this.calculateTension(narrative, ledger);
    const coherenceScore = this.calculateCoherence(narrative);
    
    return {
      wordCount,
      dialogueRatio,
      pacingScore,
      thematicResonance,
      voiceConsistency,
      hasAction,
      hasEnvironmentalDetail,
      hasSomaticDetail,
      hasEmotionalDepth,
      tensionLevel,
      coherenceScore
    };
  }

  private calculateDialogueRatio(text: string): number {
    const dialogueMatches = text.match(/"[^"]+"|'[^']+'/g);
    if (!dialogueMatches) return 0;
    const dialogueLength = dialogueMatches.reduce((acc, str) => acc + str.length, 0);
    return dialogueLength / text.length;
  }

  private calculatePacingScore(text: string): number {
    // Ideally, sentence lengths should vary. High variance = good pacing.
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return 0;
    
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize: standard deviation around 10-15 is good.
    return Math.min(1, stdDev / 15);
  }

  private calculateThematicResonance(text: string, activePrefect?: PrefectDNA): number {
    const lower = text.toLowerCase();
    let hits = 0;
    
    // Base Thematic Resonance
    Object.values(THEMATIC_KEYWORDS).forEach(list => {
      list.forEach(word => {
        if (lower.includes(word)) hits++;
      });
    });

    // Prefect-Specific Resonance
    let prefectBonus = 0;
    if (activePrefect) {
      const archetypeKeywords = ARCHETYPE_THEMES[activePrefect.archetype] || [];
      
      // Extract keywords from drive string (simple heuristic: words > 4 chars)
      const driveKeywords = activePrefect.drive
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 4 && !['become', 'their', 'which', 'that', 'with'].includes(w));
      
      const specificThemes = new Set([...archetypeKeywords, ...driveKeywords]);
      
      let specificHits = 0;
      specificThemes.forEach(word => {
        if (lower.includes(word)) specificHits++;
      });

      // Weight archetype matches heavily as they represent character-specific narrative integrity
      if (specificHits > 0) {
        prefectBonus = specificHits * 0.4;
      }
    }

    // Cap at 1.0 (approx 5 thematic words per text is "full resonance", plus potential prefect bonus)
    return Math.min(1, (hits / 5) + prefectBonus);
  }

  private calculateVoiceConsistency(text: string): number {
    // Detect active speakers
    let consistent = 1.0;
    const lower = text.toLowerCase();
    
    Object.entries(VOICE_SIGNATURES).forEach(([name, sig]) => {
        if (lower.includes(name.toLowerCase())) {
            // Check for forbidden words if character is present
            const hasForbidden = sig.forbidden.some(word => lower.includes(word));
            if (hasForbidden) consistent -= 0.2;
            
            // Boost if keywords present
            const hasKeywords = sig.keywords.some(word => lower.includes(word));
            if (!hasKeywords) consistent -= 0.1;
        }
    });
    
    return Math.max(0, consistent);
  }

  private calculateTension(narrative: string, ledger: YandereLedger): number {
    let tension = 0;
    tension += ledger.traumaLevel / 200;
    tension += ledger.shamePainAbyssLevel / 200;
    tension += (100 - ledger.hopeLevel) / 200;
    
    const tensionWords = ['suddenly', 'violently', 'sharply', 'silence', 'scream', 'breaking', 'shattering'];
    tensionWords.forEach(word => { if (new RegExp(word, 'i').test(narrative)) tension += 0.05; });
    
    return Math.min(1, tension);
  }

  private calculateCoherence(narrative: string): number {
    if (this.previousNarratives.length === 0) return 1;
    const last = this.previousNarratives[this.previousNarratives.length - 1].toLowerCase();
    const current = narrative.toLowerCase();
    
    // Very basic continuity check: Location names overlap?
    const locations = ['dock', 'office', 'infirmary', 'cell', 'hallway'];
    const lastLoc = locations.find(l => last.includes(l));
    const curLoc = locations.find(l => current.includes(l));
    
    if (lastLoc && curLoc && lastLoc !== curLoc) {
        // Only coherent if movement verb present
        if (!/walk|led|drag|enter|leave/.test(current)) return 0.4;
    }
    return 1.0;
  }

  private identifyIssues(
    narrative: string,
    metrics: QualityMetrics,
    ledger: YandereLedger
  ): NarrativeIssue[] {
    const issues: NarrativeIssue[] = [];
    
    // CRITICAL
    if (metrics.wordCount < this.minWordCount) {
      issues.push({ severity: 'critical', category: 'length', message: `Narrative too short (${metrics.wordCount} words). Expand sensory details.`, autoFixable: true });
    }
    if (metrics.thematicResonance < 0.2) {
      issues.push({ severity: 'warning', category: 'theme', message: 'Low thematic resonance. Inject more industrial/somatic metaphors.', autoFixable: false });
    }
    
    // PACING
    if (metrics.dialogueRatio > 0.6) {
        issues.push({ severity: 'suggestion', category: 'pacing', message: '"Talking Heads" detected. Reduce dialogue, increase environmental action.', autoFixable: false });
    }
    if (metrics.pacingScore < 0.3) {
        issues.push({ severity: 'suggestion', category: 'pacing', message: 'Monotone pacing. Vary sentence structure length.', autoFixable: false });
    }
    
    // DETAIL
    if (!metrics.hasEnvironmentalDetail) issues.push({ severity: 'warning', category: 'detail', message: 'Missing environmental grounding.', autoFixable: false });
    if (!metrics.hasSomaticDetail && ledger.traumaLevel > 40) issues.push({ severity: 'warning', category: 'detail', message: 'High trauma requires somatic focus (pulse, sweat, pain).', autoFixable: false });
    
    // VOICE
    if (metrics.voiceConsistency < 0.7) {
        issues.push({ severity: 'warning', category: 'voice', message: 'Character voice drift detected. Check forbidden vocabulary.', autoFixable: false });
    }

    return issues;
  }

  private evaluateQuality(metrics: QualityMetrics, issues: NarrativeIssue[]): boolean {
    if (issues.some(i => i.severity === 'critical')) return false;
    if (issues.filter(i => i.severity === 'warning').length > 3) return false;
    return true;
  }

  /**
   * Attempts to automatically fix issues
   */
  autoFixNarrative(narrative: string, issues: NarrativeIssue[], context: GameState): string {
    let fixed = narrative;
    // Simple expansion logic for length issues
    if (issues.some(i => i.category === 'length' && i.message.includes('short'))) {
        const expansion = "The air grows heavy with the metallic scent of anticipation. Shadows lengthen across the floor, pooling like spilled ink.";
        fixed = fixed.replace(/([.!?])\s/, `$1 ${expansion} `);
    }
    return fixed;
  }

  recordNarrative(narrative: string): void {
    this.previousNarratives.push(narrative);
    if (this.previousNarratives.length > 5) this.previousNarratives.shift();
  }

  generateImprovementPrompt(issues: NarrativeIssue[]): string {
    if (issues.length === 0) return '';
    const critical = issues.filter(i => i.severity === 'critical').map(i => i.message);
    const warnings = issues.filter(i => i.severity === 'warning').map(i => i.message);
    
    return `
    NARRATIVE QUALITY AUDIT:
    ${critical.length > 0 ? `CRITICAL FIXES REQUIRED:\n- ${critical.join('\n- ')}` : ''}
    ${warnings.length > 0 ? `STYLISTIC ADJUSTMENTS:\n- ${warnings.join('\n- ')}` : ''}
    `.trim();
  }

  reset(): void {
    this.previousNarratives = [];
  }
}

export const narrativeQualityEngine = new NarrativeQualityEngine();
